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

NEEDS_EDIT=0
if [ ! -f backend/.env.docker ]; then
  cp backend/.env.docker.example backend/.env.docker
  echo "[OK] Dibuat file backend/.env.docker"
  NEEDS_EDIT=1
fi
# Konfigurasi masih placeholder? Perlu diedit.
if grep -q "GANTI_DENGAN_ACAK" backend/.env.docker; then
  NEEDS_EDIT=1
fi
if [ "${NEEDS_EDIT}" = "1" ]; then
  echo "Membuka editor untuk mengisi konfigurasi (JWT_SECRET, email/password admin, kunci AI)..."
  EDITOR_BIN="${EDITOR:-}"
  if [ -z "${EDITOR_BIN}" ]; then
    if command -v nano >/dev/null 2>&1; then EDITOR_BIN=nano
    elif command -v vi >/dev/null 2>&1; then EDITOR_BIN=vi
    fi
  fi
  if [ -n "${EDITOR_BIN}" ]; then
    "${EDITOR_BIN}" backend/.env.docker
  else
    echo "Editor teks tidak ditemukan. Edit manual backend/.env.docker lalu jalankan ulang."
    exit 0
  fi
  if grep -q "GANTI_DENGAN_ACAK" backend/.env.docker; then
    echo "[PERINGATAN] JWT_SECRET masih placeholder. Edit backend/.env.docker lalu jalankan ulang skrip ini."
    exit 1
  fi
fi

echo
echo "Membangun & menjalankan... (unduhan pertama bisa memakan waktu)"
docker compose up -d --build

echo
echo "================= SELESAI ================="
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo "Buka di browser:   http://${IP:-IP-KOMPUTER-INI}"
echo "==========================================="
