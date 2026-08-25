#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
DIR="$(pwd)"
mkdir -p backups
chmod +x backup-pi.sh 2>/dev/null || true
LINE="0 23 * * * cd $DIR && ./backup-pi.sh >> $DIR/backups/autobackup.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'backup-pi.sh' ; echo "$LINE" ) | crontab -
echo "Backup otomatis harian dipasang setiap pukul 23:00."
echo "Lihat jadwal : crontab -l"
echo "Log          : backups/autobackup.log"
echo "Batalkan     : crontab -e  (hapus baris backup-pi.sh)"
