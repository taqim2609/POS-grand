#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
mkdir -p backups
TS="$(date +%Y%m%d-%H%M%S)"
FILE="backups/gak-backup-$TS.gz"
echo "Membuat backup database -> $FILE"
docker compose exec -T mongo sh -c 'mongodump --archive --gzip' > "$FILE"
echo "Selesai. Backup tersimpan di $FILE"
# Hapus backup lebih lama dari 30 hari
find backups -name 'gak-backup-*.gz' -mtime +30 -delete 2>/dev/null || true
