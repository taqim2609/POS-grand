#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "=== Bootstrap Grand Aceh POS (Raspberry Pi) ==="
if ! command -v docker >/dev/null 2>&1; then
  echo "Memasang Docker (butuh internet)..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER" 2>/dev/null || true
  echo "[OK] Docker terpasang."
fi
chmod +x install-pi.sh
echo "Menjalankan installer (memakai sudo)..."
sudo ./install-pi.sh
