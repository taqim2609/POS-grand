#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "============================================"
echo "  Grand Aceh Kuliner POS - Installer Pi/Linux"
echo "============================================"
echo

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] Docker belum terpasang. Pasang dulu:"
  echo "  curl -fsSL https://get.docker.com | sh"
  echo "Lalu jalankan ulang skrip ini."
  exit 1
fi

# Raspberry Pi / ARM -> MongoDB 4.4 (versi terbaru tidak jalan di CPU Pi)
if [ ! -f .env ]; then
  ARCH="$(uname -m)"
  case "$ARCH" in
    aarch64|armv7l|armv8*)
      echo "MONGO_IMAGE=mongo:4.4" > .env
      echo "[OK] Terdeteksi ARM ($ARCH) -> memakai mongo:4.4"
      ;;
  esac
fi

if [ ! -f backend/.env.docker ]; then
  cp backend/.env.docker.example backend/.env.docker
  echo "[OK] Dibuat file backend/.env.docker"
  echo
  echo "PENTING: edit backend/.env.docker -> ganti JWT_SECRET, isi email/password admin,"
  echo "dan kunci AI Anda (EMERGENT_LLM_KEY biarkan kosong). Lalu jalankan ulang skrip ini."
  exit 0
fi

echo
echo "Membangun & menjalankan... (unduhan pertama bisa memakan waktu)"
docker compose up -d --build

echo
echo "================= SELESAI ================="
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo "Buka di browser:   http://${IP:-IP-KOMPUTER-INI}"
echo "==========================================="
