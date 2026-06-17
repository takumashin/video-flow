#!/usr/bin/env bash
# Run ON THE SERVER via cloud console / VNC to debug "Permission denied".
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  exec sudo -E bash "$0" "$@"
fi

echo "=== SSH effective config ==="
sshd -T 2>/dev/null | grep -iE '^(permitrootlogin|passwordauthentication|pubkeyauthentication|usepam|authenticationmethods) ' || true

echo ""
echo "=== Config files (grep) ==="
grep -riE '^(PermitRootLogin|PasswordAuthentication|PubkeyAuthentication|Match)' \
  /etc/ssh/sshd_config /etc/ssh/sshd_config.d/ 2>/dev/null || true

echo ""
echo "=== Root account status ==="
passwd -S root 2>/dev/null || echo "cannot read root password status"

echo ""
echo "=== SSH service ==="
systemctl is-active sshd 2>/dev/null || systemctl is-active ssh 2>/dev/null || echo "ssh service not found"

echo ""
echo "=== Listening on port 22 ==="
ss -lntp 2>/dev/null | grep ':22 ' || netstat -lntp 2>/dev/null | grep ':22 ' || echo "nothing listening on 22"

echo ""
echo "=== Recent SSH auth failures (last 20) ==="
journalctl -u sshd -u ssh --no-pager -n 20 2>/dev/null | grep -iE 'failed|invalid|refused|denied' || \
  tail -20 /var/log/auth.log 2>/dev/null || \
  tail -20 /var/log/secure 2>/dev/null || \
  echo "no auth logs found"

echo ""
echo "=== fail2ban (if installed) ==="
if command -v fail2ban-client >/dev/null 2>&1; then
  fail2ban-client status sshd 2>/dev/null || fail2ban-client status 2>/dev/null || true
else
  echo "fail2ban not installed"
fi

echo ""
echo "=== Fix ==="
echo "If PasswordAuthentication is 'no' or PermitRootLogin is 'no'/'prohibit-password', run:"
echo "  bash /path/to/enable-root-ssh.sh"
