#!/usr/bin/env bash
# ============================================================
# Update Grand Aceh Kuliner POS dari vibecoder.co.id
# (pengganti alur "git pull dari GitHub" — cukup internet biasa)
#
# Pakai:
#   bash update-vibecoder-pi.sh                 # update manual
#   bash update-vibecoder-pi.sh 62811687783     # + notifikasi WA ke nomor
#
# Aman: bila versi remote sama dengan versi terpasang, TIDAK melakukan apa-apa
# (tidak unduh, tidak rebuild). Dijalankan juga oleh cron auto-update
# (lihat check-update-pi.sh) dan oleh tombol "Update Sekarang" 1-klik.
#
# File lokal yang TIDAK ada di arsip (jadi TIDAK ikut ditimpa):
#   .env, backend/.env.docker, backups/, .git, update-auto.log
# ============================================================
set -e
cd "$(dirname "$0")"

BASE_URL="https://taqim258.vibecoder.co.id/pos-grand-update"
VER_FILE=".vibecoder-version"
NOTIFY="${1:-}"

TS() { date "+%Y-%m-%d %H:%M:%S"; }
echo "[$(TS)] Cek update dari vibecoder.co.id ..."

# --- versi remote vs versi lokal ---
REMOTE_VER="$(curl -fsSL -m 30 "$BASE_URL/version.json" 2>/dev/null | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4 || true)"
if [ -z "$REMOTE_VER" ]; then
  echo "[$(TS)] Tidak bisa menghubungi $BASE_URL (internet mati / alamat tidak terjangkau)."
  exit 0
fi
LOCAL_VER="$(cat "$VER_FILE" 2>/dev/null || echo "")"
if [ -n "$LOCAL_VER" ] && [ "$LOCAL_VER" = "$REMOTE_VER" ]; then
  echo "[$(TS)] Sudah versi terbaru ($REMOTE_VER). Tidak ada update."
  exit 0
fi

echo "[$(TS)] Versi baru ditemukan: ${LOCAL_VER:-(belum ada)} -> $REMOTE_VER. Mengunduh ..."
curl -fsSL -m 300 -o /tmp/gak-pos-update.tar.gz "$BASE_URL/pos-grand.tar.gz"
test -s /tmp/gak-pos-update.tar.gz

# Ekstrak DI TEMPAT. .env / backend/.env.docker / backups/ tidak ada di arsip -> aman.
tar xzf /tmp/gak-pos-update.tar.gz -C .
rm -f /tmp/gak-pos-update.tar.gz

# --- Simpan path host untuk fitur "Update Sekarang" 1-klik (.env bisa milik root) ---
DOCKER="docker"; docker info >/dev/null 2>&1 || DOCKER="sudo docker"
SUDO=""; [ -e .env ] && [ ! -w .env ] && SUDO="sudo"
ENV_TMP="$(mktemp)"
grep -v '^HOST_PROJECT_DIR=' .env > "$ENV_TMP" 2>/dev/null || true
echo "HOST_PROJECT_DIR=$(pwd)" >> "$ENV_TMP"
$SUDO cp "$ENV_TMP" .env && rm -f "$ENV_TMP"

echo "[$(TS)] Membangun & menjalankan versi terbaru ..."
$DOCKER compose up -d --build
$DOCKER image prune -f >/dev/null 2>&1 || true

# Catat versi (file bisa jadi milik root dari update 1-klik)
VER_TMP="$(mktemp)"; echo "$REMOTE_VER" > "$VER_TMP"
SUDO2=""; [ -e "$VER_FILE" ] && [ ! -w "$VER_FILE" ] && SUDO2="sudo"
$SUDO2 cp "$VER_TMP" "$VER_FILE" && rm -f "$VER_TMP"
echo "[$(TS)] Update selesai ke $REMOTE_VER."

# --- Notifikasi WhatsApp (opsional, hanya bila nomor diberikan) ---
if [ -n "$NOTIFY" ]; then
  SECRET="$(grep -E '^WEBHOOK_CRON_SECRET=' backend/.env.docker 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')"
  if [ -n "$SECRET" ]; then
    MSG="Grand Aceh Kuliner POS: server berhasil diperbarui ke versi $REMOTE_VER pada $(TS). Aplikasi kasir akan ikut ter-update otomatis."
    echo "[$(TS)] Menunggu backend siap lalu kirim notifikasi WA ke $NOTIFY ..."
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
