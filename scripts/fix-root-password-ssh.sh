#!/usr/bin/env bash
# Run ON THE SERVER via cloud console / VNC when SSH says:
#   "Permission denied, please try again"
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  exec sudo -E bash "$0" "$@"
fi

echo "=== Root account ==="
passwd -S root 2>/dev/null || true

if passwd -S root 2>/dev/null | grep -q " L "; then
  echo "Root is LOCKED — unlocking ..."
  passwd -u root
fi

echo ""
echo "=== Set a fresh root password ==="
echo "Type the new password carefully (nothing will show while typing)."
passwd root

echo ""
echo "=== Verify password works locally ==="
echo "Testing su with the password you just set ..."
if su - root -c "echo LOCAL_LOGIN_OK" <<<"" 2>/dev/null; then
  echo "Root shell works on this machine."
else
  echo "Run this manually to double-check:  su - root"
fi

echo ""
echo "=== Allow root over SSH (/etc/securetty) ==="
if [[ -f /etc/securetty ]]; then
  for i in 0 1 2 3; do
    grep -qxF "pts/${i}" /etc/securetty || echo "pts/${i}" >>/etc/securetty
  done
fi

echo ""
echo "=== SSH password auth must be ON ==="
mkdir -p /etc/ssh/sshd_config.d
cat >/etc/ssh/sshd_config.d/99-enable-root-password.conf <<'EOF'
PermitRootLogin yes
PasswordAuthentication yes
PubkeyAuthentication yes
KbdInteractiveAuthentication yes
UsePAM yes
EOF

for f in /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf; do
  [[ -f "$f" ]] || continue
  [[ "$f" == *99-enable-root-password.conf ]] && continue
  sed -i -E 's/^[#[:space:]]*(PasswordAuthentication)[[:space:]]+.*/\1 yes/I' "$f" 2>/dev/null || true
  sed -i -E 's/^[#[:space:]]*(PermitRootLogin)[[:space:]]+.*/\1 yes/I' "$f" 2>/dev/null || true
  sed -i -E '/^[[:space:]]*DenyUsers[[:space:]]+.*root/d' "$f" 2>/dev/null || true
done

if command -v fail2ban-client >/dev/null 2>&1; then
  fail2ban-client unban --all >/dev/null 2>&1 || true
  echo "Cleared fail2ban bans"
fi

sshd -t
systemctl restart sshd 2>/dev/null || systemctl restart ssh

echo ""
echo "Effective settings:"
sshd -T | grep -iE '^(permitrootlogin|passwordauthentication|usepam) '

echo ""
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo "From your laptop, connect with:"
if [[ -n "$IP" ]]; then
  echo "  ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@${IP}"
else
  echo "  ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@YOUR_SERVER_IP"
fi
echo ""
echo "Use the NEW password you just set. Old passwords will not work."
