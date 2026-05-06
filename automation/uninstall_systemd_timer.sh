#!/usr/bin/env bash
set -euo pipefail
if [[ "$EUID" -ne 0 ]]; then
  echo "Ejecuta como root: sudo automation/uninstall_systemd_timer.sh" >&2
  exit 1
fi
systemctl disable --now bmr-web-export.timer || true
rm -f /etc/systemd/system/bmr-web-export.timer /etc/systemd/system/bmr-web-export.service
systemctl daemon-reload
systemctl reset-failed bmr-web-export.service bmr-web-export.timer || true
echo "OK: timer y servicio eliminados."
