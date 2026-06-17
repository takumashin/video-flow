#!/usr/bin/env bash
# Run ON THE SERVER via cloud console / VNC (root or sudo).
# Enables root SSH login with password.
set -euo pipefail

SSHD_CONFIG="/etc/ssh/sshd_config"
SSHD_CONFIG_DIR="/etc/ssh/sshd_config.d"
OVERRIDE_FILE="${SSHD_CONFIG_DIR}/99-enable-root-password.conf"
BACKUP_DIR="/etc/ssh/backups"

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    if command -v sudo >/dev/null 2>&1; then
      exec sudo -E bash "$0" "$@"
    fi
    echo "ERROR: run as root or with sudo"
    exit 1
  fi
}

backup_config() {
  mkdir -p "$BACKUP_DIR"
  local stamp
  stamp="$(date +%Y%m%d-%H%M%S)"
  cp -a "$SSHD_CONFIG" "$BACKUP_DIR/sshd_config.${stamp}.bak"
  if [[ -d "$SSHD_CONFIG_DIR" ]]; then
    cp -a "$SSHD_CONFIG_DIR" "$BACKUP_DIR/sshd_config.d.${stamp}.bak"
  fi
  echo "Backup saved to $BACKUP_DIR"
}

set_sshd_option() {
  local key="$1"
  local value="$2"
  local file="$3"

  if grep -qiE "^[#[:space:]]*${key}[[:space:]]" "$file"; then
    sed -i -E "s/^[#[:space:]]*(${key})[[:space:]]+.*/\1 ${value}/I" "$file"
  else
    printf '\n%s %s\n' "$key" "$value" >>"$file"
  fi
}

apply_ssh_settings() {
  echo "Updating $SSHD_CONFIG ..."
  set_sshd_option "PermitRootLogin" "yes" "$SSHD_CONFIG"
  set_sshd_option "PasswordAuthentication" "yes" "$SSHD_CONFIG"
  set_sshd_option "PubkeyAuthentication" "yes" "$SSHD_CONFIG"
  set_sshd_option "KbdInteractiveAuthentication" "yes" "$SSHD_CONFIG"
  set_sshd_option "ChallengeResponseAuthentication" "no" "$SSHD_CONFIG"
  set_sshd_option "UsePAM" "yes" "$SSHD_CONFIG"

  if [[ -d "$SSHD_CONFIG_DIR" ]]; then
    echo "Patching drop-in files in $SSHD_CONFIG_DIR ..."
    shopt -s nullglob
    for dropin in "$SSHD_CONFIG_DIR"/*.conf; do
      [[ "$dropin" == "$OVERRIDE_FILE" ]] && continue
      set_sshd_option "PermitRootLogin" "yes" "$dropin"
      set_sshd_option "PasswordAuthentication" "yes" "$dropin"
      set_sshd_option "PubkeyAuthentication" "yes" "$dropin"
    done
    shopt -u nullglob
  fi

  mkdir -p "$SSHD_CONFIG_DIR"
  cat >"$OVERRIDE_FILE" <<'EOF'
# Added by enable-root-ssh.sh — loaded last to override cloud-init defaults
PermitRootLogin yes
PasswordAuthentication yes
PubkeyAuthentication yes
KbdInteractiveAuthentication yes
EOF
  chmod 644 "$OVERRIDE_FILE"
  echo "Wrote override file: $OVERRIDE_FILE"
}

ensure_root_unlocked() {
  if passwd -S root 2>/dev/null | grep -q " L "; then
    echo "Unlocking root account ..."
    passwd -u root
  fi
}

set_root_password() {
  echo ""
  echo "Set a new root password (input is hidden — that is normal):"
  passwd root
}

unban_local_ip_in_fail2ban() {
  if command -v fail2ban-client >/dev/null 2>&1; then
    fail2ban-client unban --all >/dev/null 2>&1 || true
    echo "Cleared fail2ban bans (if any)"
  fi
}

restart_sshd() {
  echo "Validating SSH config ..."
  if ! sshd -t; then
    echo "ERROR: invalid SSH config. Restore from $BACKUP_DIR"
    exit 1
  fi

  local service=""
  if systemctl list-unit-files 2>/dev/null | grep -q "^sshd.service"; then
    service="sshd"
  elif systemctl list-unit-files 2>/dev/null | grep -q "^ssh.service"; then
    service="ssh"
  fi

  if [[ -n "$service" ]]; then
    systemctl restart "$service"
    systemctl enable "$service" >/dev/null 2>&1 || true
    echo "Restarted ${service}"
  else
    service sshd restart || service ssh restart
  fi
}

open_firewall_ssh() {
  if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
    firewall-cmd --permanent --add-service=ssh >/dev/null 2>&1 || true
    firewall-cmd --reload >/dev/null 2>&1 || true
    echo "firewalld: SSH allowed"
  elif command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi active; then
    ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null 2>&1 || true
    echo "ufw: SSH allowed"
  fi
}

print_effective_config() {
  echo ""
  echo "Effective SSH settings (what sshd actually uses):"
  sshd -T 2>/dev/null | grep -iE '^(permitrootlogin|passwordauthentication|pubkeyauthentication|usepam) ' || true
}

print_summary() {
  local ip=""
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  echo ""
  echo "Done. Root password login should be enabled."
  echo ""
  echo "From your laptop, use password-only mode:"
  if [[ -n "$ip" ]]; then
    echo "  ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@${ip}"
  else
    echo "  ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@YOUR_SERVER_IP"
  fi
  print_effective_config
}

main() {
  require_root "$@"
  backup_config
  apply_ssh_settings
  ensure_root_unlocked
  set_root_password
  unban_local_ip_in_fail2ban
  open_firewall_ssh
  restart_sshd
  print_summary
}

main "$@"
