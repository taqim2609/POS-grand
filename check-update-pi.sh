#!/usr/bin/env bash
# ============================================================
# Cek & jalankan update HANYA bila ada versi baru di GitHub.
# Dirancang untuk dijalankan otomatis oleh cron (lihat setup-autoupdate-pi.sh).
# Aman: kalau tidak ada perubahan, tidak melakukan apa-apa.
# ============================================================
set -e
cd "$(dirname "$0")"

TS() { date "+%Y-%m-%d %H:%M:%S"; }
echo "[$(TS)] Cek update dimulai..."

# Docker butuh sudo bila user belum aktif di grup docker
DOCKER="docker"; docker info >/dev/null 2>&1 || DOCKER="sudo docker"

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
git fetch origin "$BRANCH" --quiet || { echo "[$(TS)] git fetch gagal (internet?)."; exit 0; }

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "[$(TS)] Sudah versi terbaru ($LOCAL). Tidak ada update."
  exit 0
fi

echo "[$(TS)] Versi baru ditemukan: $LOCAL -> $REMOTE. Memperbarui..."
git reset --hard "origin/$BRANCH"

# Simpan path host untuk fitur "Update Sekarang" 1-klik (.env bisa milik root)
SUDO=""; [ -e .env ] && [ ! -w .env ] && SUDO="sudo"
ENV_TMP="$(mktemp)"
grep -v '^HOST_PROJECT_DIR=' .env > "$ENV_TMP" 2>/dev/null || true
echo "HOST_PROJECT_DIR=$(pwd)" >> "$ENV_TMP"
$SUDO cp "$ENV_TMP" .env && rm -f "$ENV_TMP"

echo "[$(TS)] Build & jalankan versi terbaru..."
$DOCKER compose up -d --build
$DOCKER image prune -f >/dev/null 2>&1 || true

echo "[$(TS)] Update selesai ke $REMOTE."
