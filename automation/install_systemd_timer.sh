#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="${INSTALL_DIR:-/opt/bmr-web-private}"

if [[ "$EUID" -ne 0 ]]; then
  echo "Ejecuta como root: sudo automation/install_systemd_timer.sh" >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR"
if [[ "$REPO_ROOT" != "$INSTALL_DIR" ]]; then
  rsync -a --delete \
    --exclude '.git' \
    --exclude '.venv-exporter' \
    --exclude 'automation/logs/*.log' \
    "$REPO_ROOT/" "$INSTALL_DIR/"
fi

if [[ ! -f "$INSTALL_DIR/automation/env/daily-export.env" ]]; then
  cp "$INSTALL_DIR/automation/env/daily-export.env.example" "$INSTALL_DIR/automation/env/daily-export.env"
  echo "Creado $INSTALL_DIR/automation/env/daily-export.env. Revísalo antes de activar producción."
fi

install -m 0644 "$INSTALL_DIR/automation/systemd/bmr-web-export.service" /etc/systemd/system/bmr-web-export.service
install -m 0644 "$INSTALL_DIR/automation/systemd/bmr-web-export.timer" /etc/systemd/system/bmr-web-export.timer
systemctl daemon-reload
systemctl enable --now bmr-web-export.timer
systemctl list-timers bmr-web-export.timer --no-pager

echo "OK. Prueba manual: sudo systemctl start bmr-web-export.service"
echo "Logs: journalctl -u bmr-web-export.service -n 200 --no-pager"
