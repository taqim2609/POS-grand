#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "=== Update Grand Aceh Kuliner POS (Pi/Linux) ==="
if [ -d .git ]; then
  echo "Menarik pembaruan terbaru dari Git..."
  # Tandai folder sebagai aman (cegah error "dubious ownership").
  git config --global --add safe.directory "$(pwd)" 2>/dev/null || true

  ME="$(id -un)"; GRP="$(id -gn)"
  # Deteksi objek .git milik user lain (biasanya root, akibat pernah pakai sudo)
  # yang menyebabkan "insufficient permission for adding an object".
  if [ -n "$(find .git ! -user "$ME" -print -quit 2>/dev/null)" ]; then
    echo "Memperbaiki kepemilikan folder .git (perlu sudo sekali) ..."
    sudo chown -R "$ME":"$GRP" .git 2>/dev/null || true
  fi

  if ! git pull --ff-only; then
    echo "git pull gagal. Mencoba memperbaiki izin seluruh folder lalu ulang ..."
    sudo chown -R "$ME":"$GRP" . 2>/dev/null || true
    git config --global --add safe.directory "$(pwd)" 2>/dev/null || true
    git pull --ff-only || echo "(git pull tetap dilewati — cek koneksi internet / izin folder)"
  fi
fi
# Docker butuh sudo bila user belum aktif di grup docker
DOCKER="docker"; docker info >/dev/null 2>&1 || DOCKER="sudo docker"

# Pastikan path host tersimpan untuk fitur "Update Sekarang" 1-klik.
# .env bisa dimiliki root (dibuat via sudo) -> pakai sudo bila tidak bisa ditulis.
SUDO=""; [ -e .env ] && [ ! -w .env ] && SUDO="sudo"
ENV_TMP="$(mktemp)"
grep -v '^HOST_PROJECT_DIR=' .env > "$ENV_TMP" 2>/dev/null || true
echo "HOST_PROJECT_DIR=$(pwd)" >> "$ENV_TMP"
$SUDO cp "$ENV_TMP" .env && rm -f "$ENV_TMP"

echo "Membangun ulang & menjalankan versi terbaru..."
$DOCKER compose up -d --build
$DOCKER image prune -f >/dev/null 2>&1 || true
echo "Selesai. Aplikasi sudah versi terbaru."
