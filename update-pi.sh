#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "=== Update Grand Aceh Kuliner POS (Pi/Linux) ==="
if [ -d .git ]; then
  echo "Menarik pembaruan terbaru dari Git..."
  git pull --ff-only || echo "(git pull dilewati)"
fi
echo "Membangun ulang & menjalankan versi terbaru..."
docker compose up -d --build
docker image prune -f >/dev/null 2>&1 || true
echo "Selesai. Aplikasi sudah versi terbaru."
