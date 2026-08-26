#!/usr/bin/env bash
# ============================================================
# Backup database lalu kirim salinan ke vibecoder.co.id (mirror tambahan).
# Dipakai oleh tombol "Kirim Backup" di app (via container docker:cli)
# dan bisa juga dijalankan manual / cron:
#   ./backup-to-vibecoder.sh
#
# Backup LOKAL selalu dibuat di backups/ (sumber utama). Salinan di
# vibecoder.co.id adalah cadangan TAMBAHAN — jangan dijadikan satu-satunya.
# ============================================================
set -e
cd "$(dirname "$0")"

mkdir -p backups
TS="$(date +%Y%m%d-%H%M%S)"
FILE="backups/gak-backup-$TS.gz"
echo "=== Backup Grand Aceh POS -> vibecoder.co.id ==="
echo "Membuat backup database -> $FILE"
docker compose exec -T mongo sh -c 'mongodump --archive --gzip' > "$FILE"
echo "[OK] Backup lokal tersimpan: $FILE ($(du -h "$FILE" | cut -f1))"

# Token & konfigurasi (prioritas: env dari container, lalu backend/.env.docker)
TOKEN="${VIBE_BACKUP_TOKEN:-$(grep -E '^VIBE_BACKUP_TOKEN=' backend/.env.docker 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')}"
TOKEN="${TOKEN:-gak_bkp_2a8d51c4}"
PASS="${VIBE_BACKUP_PASS:-$(grep -E '^VIBE_BACKUP_PASS=' backend/.env.docker 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')}"
URL="${VIBE_BACKUP_URL:-https://taqim258.vibecoder.co.id/pos-grand-update/bkp.php}"

UPFILE="$FILE"
if [ -n "$PASS" ]; then
  UPFILE="$FILE.enc"
  openssl enc -aes-256-cbc -pbkdf2 -salt -pass "pass:$PASS" -in "$FILE" -out "$UPFILE"
  echo "[OK] Backup dienkripsi AES-256 -> $UPFILE"
else
  echo "[PERINGATAN] VIBE_BACKUP_PASS belum diset di backend/.env.docker — backup dikirim TANPA enkripsi."
fi

echo "Mengirim ke vibecoder.co.id ..."
if curl -fsSL -m 300 -X POST -H "X-Gak-Token: $TOKEN" -H "Content-Type: application/octet-stream" --data-binary "@$UPFILE" "$URL"; then
  echo ""
  echo "[OK] Salinan berhasil dikirim ke vibecoder.co.id."
else
  echo ""
  echo "[GAGAL] Kirim ke vibecoder.co.id gagal (internet mati / layanan tidak terjangkau). Backup lokal tetap aman."
fi

# Bersihkan file enkripsi sementara (backup asli di backups/ TETAP)
[ -n "$PASS" ] && rm -f "$UPFILE" 2>/dev/null || true
# Prune backup lokal lebih dari 30 hari
find backups -name 'gak-backup-*.gz' -mtime +30 -delete 2>/dev/null || true
echo "Selesai."
