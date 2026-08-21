#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
FILE="$1"
if [ -z "$FILE" ]; then
  echo "Pemakaian: ./restore-pi.sh backups/gak-backup-XXXX.gz"
  echo "Daftar backup tersedia:"
  ls -1 backups/*.gz 2>/dev/null || echo "(belum ada backup)"
  exit 1
fi
echo "PERINGATAN: ini akan MENIMPA seluruh data saat ini dengan isi $FILE"
read -p "Ketik YA untuk lanjut: " ok
[ "$ok" = "YA" ] || { echo "Dibatalkan."; exit 1; }
docker compose exec -T mongo sh -c 'mongorestore --archive --gzip --drop' < "$FILE"
echo "Restore selesai."
