#!/usr/bin/env bash
set -e
# Install & update Grand Aceh POS LANGSUNG dari GitHub.
# Repo default bisa ditimpa:  REPO_URL=... APP_DIR=... ./bootstrap-pi.sh
REPO="${REPO_URL:-https://github.com/taqim2609/POS-grand.git}"
APP_DIR="${APP_DIR:-$HOME/grand-aceh-pos}"

echo "=== Bootstrap Grand Aceh POS (Raspberry Pi / GitHub) ==="
echo "Repo   : $REPO"
echo "Folder : $APP_DIR"
echo

# 1. git
if ! command -v git >/dev/null 2>&1; then
  echo "Memasang git..."
  sudo apt-get update && sudo apt-get install -y git
fi

# 2. Docker
if ! command -v docker >/dev/null 2>&1; then
  echo "Memasang Docker (butuh internet)..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER" 2>/dev/null || true
  sudo systemctl enable docker 2>/dev/null || true
  echo "[OK] Docker terpasang."
fi

# 3. Ambil / perbarui kode dari GitHub
if [ -d "$APP_DIR/.git" ]; then
  echo "Proyek sudah ada -> menarik pembaruan (git pull)..."
  git -C "$APP_DIR" pull --ff-only || true
else
  echo "Mengunduh proyek dari GitHub..."
  git clone "$REPO" "$APP_DIR"
fi

# 4. Jalankan installer
cd "$APP_DIR"
chmod +x install-pi.sh update-pi.sh restart-pi.sh backup-pi.sh restore-pi.sh setup-autobackup-pi.sh 2>/dev/null || true
echo "Menjalankan installer..."
sudo ./install-pi.sh
