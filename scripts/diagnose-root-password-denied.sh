#!/usr/bin/env bash
# Run ON THE SERVER (cloud console / VNC) when password is correct but SSH still fails.
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  exec sudo -E bash "$0" "$@"
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}OK${NC}    $*"; }
warn() { echo -e "${YELLOW}WARN${NC}  $*"; }
bad()  { echo -e "${RED}FAIL${NC}  $*"; }

echo "========== SSH root login deep diagnosis =========="
echo ""

echo "--- 1. Effective sshd settings (what actually applies) ---"
EFFECTIVE="$(sshd -T 2>/dev/null || true)"
for key in permitrootlogin passwordauthentication pubkeyauthentication usepam authenticationmethods allowusers denyusers allowgroups denygroups; do
  echo "$EFFECTIVE" | grep -i "^${key} " || echo "${key} (not set)"
done
echo ""

echo "--- 2. Root account ---"
passwd -S root 2>/dev/null || bad "cannot read root status"
ROOT_SHADOW="$(getent shadow root 2>/dev/null | cut -d: -f2 || true)"
if [[ "$ROOT_SHADOW" == "!"* ]] || [[ "$ROOT_SHADOW" == "*"* ]] || [[ -z "$ROOT_SHADOW" ]]; then
  bad "root password field in /etc/shadow is locked or empty"
else
  ok "root has a password hash in /etc/shadow"
fi
chage -l root 2>/dev/null | head -5 || true
echo ""

echo "--- 3. /etc/securetty (can block root login) ---"
if [[ -f /etc/securetty ]]; then
  if grep -qE '^[[:space:]]*pts/' /etc/securetty 2>/dev/null; then
    ok "/etc/securetty allows pts (SSH)"
  else
    bad "/etc/securetty may BLOCK root over SSH — pts/* missing"
    echo "       Fix: echo 'pts/0' >> /etc/securetty (and pts/1, pts/2 ...)"
  fi
else
  ok "no /etc/securetty (not blocking)"
fi
echo ""

echo "--- 4. PAM for SSH ---"
PAM_FILE=""
for f in /etc/pam.d/sshd /etc/pam.d/ssh; do
  [[ -f "$f" ]] && PAM_FILE="$f" && break
done
if [[ -n "$PAM_FILE" ]]; then
  echo "Using $PAM_FILE"
  grep -v '^#' "$PAM_FILE" | grep -v '^$' || true
else
  warn "PAM sshd file not found"
fi
echo ""

echo "--- 5. Drop-in configs (cloud-init often breaks root password login) ---"
grep -rniE 'permitrootlogin|passwordauthentication|allowusers|denyusers|match ' \
  /etc/ssh/sshd_config /etc/ssh/sshd_config.d/ 2>/dev/null || true
echo ""

echo "--- 6. Recent SSH failures ---"
journalctl -u sshd -u ssh --no-pager -n 15 2>/dev/null | tail -15 || \
  tail -15 /var/log/auth.log 2>/dev/null || \
  tail -15 /var/log/secure 2>/dev/null || true
echo ""

echo "--- 7. fail2ban ---"
if command -v fail2ban-client >/dev/null 2>&1; then
  fail2ban-client status sshd 2>/dev/null || fail2ban-client status 2>/dev/null || echo "no ssh jail"
else
  echo "not installed"
fi
echo ""

# Auto-detect common blockers
echo "========== Verdict =========="
PR="$(echo "$EFFECTIVE" | grep -i '^permitrootlogin ' | awk '{print $2}')"
PA="$(echo "$EFFECTIVE" | grep -i '^passwordauthentication ' | awk '{print $2}')"
ISSUES=0

if [[ "$PR" == "no" ]]; then
  bad "PermitRootLogin is NO — root cannot SSH at all"
  ISSUES=1
elif [[ "$PR" == "prohibit-password" ]] || [[ "$PR" == "forced-commands-only" ]]; then
  bad "PermitRootLogin=$PR — root password login is DISABLED (keys only)"
  ISSUES=1
fi

if [[ "$PA" == "no" ]]; then
  bad "PasswordAuthentication is NO — password will never work"
  ISSUES=1
fi

if echo "$EFFECTIVE" | grep -qi '^denyusers .*root'; then
  bad "DenyUsers includes root"
  ISSUES=1
fi

if echo "$EFFECTIVE" | grep -qi '^allowusers ' && ! echo "$EFFECTIVE" | grep -qi '^allowusers .*root'; then
  bad "AllowUsers is set but does NOT include root"
  ISSUES=1
fi

if [[ "$ISSUES" -eq 0 ]]; then
  warn "sshd config looks OK for root password login."
  warn "If password is still rejected, common causes:"
  echo "  - Wrong username (try: ubuntu, debian, ec2-user, admin)"
  echo "  - Password correct for console but not for root (reset: passwd root)"
  echo "  - Your IP banned by fail2ban"
  echo "  - Keyboard layout / special characters when typing password"
fi

echo ""
echo "========== One-shot fix (run if issues found) =========="
echo "  bash $(dirname "$0")/fix-root-password-ssh.sh"
