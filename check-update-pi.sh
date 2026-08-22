#!/usr/bin/env bash
# ============================================================
# Cek & jalankan update HANYA bila ada versi baru di GitHub.
# Dijalankan otomatis oleh cron (lihat setup-autoupdate-pi.sh).
# Argumen opsional: nomor WhatsApp tujuan notifikasi (mis. 62811687783).
# Aman: kalau tidak ada perubahan, tidak melakukan apa-apa & tidak kirim WA.
# ============================================================
set -e
cd "$(dirname "$0")"

NOTIFY="${1:-}"
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

# --- Kirim notifikasi WhatsApp (hanya bila ada update & nomor diberikan) ---
if [ -n "$NOTIFY" ]; then
  SECRET="$(grep -E '^WEBHOOK_CRON_SECRET=' backend/.env.docker 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')"
  if [ -n "$SECRET" ]; then
    SHORT="$(git rev-parse --short HEAD)"
    MSG="Grand Aceh Kuliner POS: server berhasil diperbarui ke versi terbaru pada $(TS) (commit $SHORT). Aplikasi kasir akan ikut ter-update otomatis."
    echo "[$(TS)] Menunggu backend siap lalu kirim notifikasi WA ke $NOTIFY..."
    sleep 20
    curl -s -m 30 -X POST "http://localhost/api/cron/notify" \
      -H "Authorization: Bearer $SECRET" -H "Content-Type: application/json" \
      -d "{\"to\":\"$NOTIFY\",\"message\":\"$MSG\"}" >/dev/null \
      && echo "[$(TS)] Notifikasi WA terkirim ke $NOTIFY." \
      || echo "[$(TS)] Gagal kirim notifikasi WA (cek konfigurasi wacloud.id)."
  else
    echo "[$(TS)] WEBHOOK_CRON_SECRET tidak ada di backend/.env.docker — lewati notifikasi."
  fi
fi
