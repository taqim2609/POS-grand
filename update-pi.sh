#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "=== Update Grand Aceh Kuliner POS (Pi/Linux) ==="
if [ -d .git ]; then
  echo "Menarik pembaruan terbaru dari Git..."
  git pull --ff-only || echo "(git pull dilewati)"
fi
# Pastikan path host tersimpan untuk fitur "Update Sekarang" 1-klik
touch .env
grep -v '^HOST_PROJECT_DIR=' .env > .env.tmp 2>/dev/null || true
echo "HOST_PROJECT_DIR=$(pwd)" >> .env.tmp
mv .env.tmp .env

echo "Membangun ulang & menjalankan versi terbaru..."
docker compose up -d --build
docker image prune -f >/dev/null 2>&1 || true
echo "Selesai. Aplikasi sudah versi terbaru."
