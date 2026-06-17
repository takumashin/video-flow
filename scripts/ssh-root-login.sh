#!/usr/bin/env bash
# Run on YOUR LAPTOP to connect as root with password (not SSH keys).
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <server-ip-or-hostname> [port]"
  echo ""
  echo "Example:"
  echo "  $0 203.0.113.10"
  echo "  $0 203.0.113.10 2222"
  exit 1
fi

HOST="$1"
PORT="${2:-22}"

exec ssh \
  -o PreferredAuthentications=password \
  -o PubkeyAuthentication=no \
  -o NumberOfPasswordPrompts=3 \
  -p "$PORT" \
  "root@${HOST}"
