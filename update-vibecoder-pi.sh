#!/usr/bin/env bash
# ============================================================
# Update Grand Aceh Kuliner POS dari vibecoder.co.id
# (pengganti alur "git pull dari GitHub" — cukup internet biasa)
#
# Pakai:
#   bash update-vibecoder-pi.sh                 # update manual
#   bash update-vibecoder-pi.sh 62811687783     # + notifikasi WA ke nomor
#   bash update-vibecoder-pi.sh --test          # diagnosa koneksi ke vibecoder.co.id
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
CURL_ERR="/tmp/gak-curl-err.txt"

TS() { date "+%Y-%m-%d %H:%M:%S"; }

# ---------- mode diagnosa ----------
if [ "${1:-}" = "--test" ]; then
  echo "=== Diagnosa koneksi ke vibecoder.co.id ==="
  echo "Jam Pi          : $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "curl            : $(command -v curl >/dev/null 2>&1 && curl --version | head -1 || echo TIDAK ADA)"
  echo "DNS vibecoder   : $(getent hosts taqim258.vibecoder.co.id | head -1 || echo 'TIDAK RESOLVE')"
  echo "--- coba HTTPS (lihat baris terakhir) ---"
  curl -v --connect-timeout 15 -m 30 "$BASE_URL/version.json" -o /dev/null 2>&1 | tail -6 || true
  echo "--- penjelasan cepat ---"
  echo "1) Kalau ada 'Could not resolve host'       -> DNS/ISP memblokir domain. Cek: getent hosts vibecoder.co.id"
  echo "2) Kalau ada 'unable to get local issuer'   -> CA lama. Jalankan: sudo apt update && sudo apt install -y ca-certificates && sudo update-ca-certificates"
  echo "3) Kalau ada 'certificate is not yet/expired' -> jam Pi salah. Jalankan: sudo date -s '$(date +%F\ %T)' atau pasang NTP"
  echo "4) Kalau ada 'Connection timed out'         -> jaringan/firewall memblokir port 443 ke vibecoder.co.id"
  exit 0
fi

NOTIFY="${1:-}"
echo "[$(TS)] Cek update dari vibecoder.co.id ..."

# --- versi remote vs versi lokal (dengan pesan error asli bila gagal) ---
REMOTE_VER="$(curl -fsSL --connect-timeout 15 -m 30 "$BASE_URL/version.json" 2>"$CURL_ERR" \
  | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4 || true)"
if [ -z "$REMOTE_VER" ]; then
  echo "[$(TS)] GAGAL menghubungi $BASE_URL"
  echo "[$(TS)] Penyebab dari curl:"
  sed 's/^/[curl] /' "$CURL_ERR" 2>/dev/null | tail -5 || true
  echo "[$(TS)] Solusi cepat:"
  echo "   - DNS:   getent hosts vibecoder.co.id  (harus ada alamat IP)"
  echo "   - CA:    sudo apt update && sudo apt install -y ca-certificates && sudo update-ca-certificates"
  echo "   - Jam:   cek 'date' — kalau salah: sudo date -s '$(date +%F\ %T)'"
  echo "   - Jaringan memblokir 443 ke vibecoder.co.id (VPN/proxy/firewall?)"
  echo "   - Diagnosa lengkap: bash update-vibecoder-pi.sh --test"
  exit 0
fi

LOCAL_VER="$(cat "$VER_FILE" 2>/dev/null || echo "")"
if [ -n "$LOCAL_VER" ] && [ "$LOCAL_VER" = "$REMOTE_VER" ]; then
  echo "[$(TS)] Sudah versi terbaru ($REMOTE_VER). Tidak ada update."
  exit 0
fi

echo "[$(TS)] Versi baru ditemukan: ${LOCAL_VER:-(belum ada)} -> $REMOTE_VER. Mengunduh ..."
if ! curl -fsSL --connect-timeout 15 -m 300 -o /tmp/gak-pos-update.tar.gz "$BASE_URL/pos-grand.tar.gz" 2>"$CURL_ERR"; then
  echo "[$(TS)] GAGAL mengunduh arsip. Penyebab dari curl:"
  sed 's/^/[curl] /' "$CURL_ERR" 2>/dev/null | tail -5 || true
  exit 0
fi
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
