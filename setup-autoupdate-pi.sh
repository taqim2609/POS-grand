#!/usr/bin/env bash
# ============================================================
# Pasang jadwal AUTO-UPDATE server Pi (via cron).
# Default: setiap hari pukul 03:00 (saat toko tutup).
# Pakai:
#   bash setup-autoupdate-pi.sh            # default 03:00
#   bash setup-autoupdate-pi.sh 2          # ubah jam (mis. 02:00)
#   bash setup-autoupdate-pi.sh off        # matikan auto-update
# ============================================================
set -e
cd "$(dirname "$0")"
DIR="$(pwd)"
SCRIPT="$DIR/check-update-pi.sh"
LOG="$DIR/update-auto.log"
TAG="# grand-aceh-pos-autoupdate"

chmod +x "$SCRIPT" 2>/dev/null || true

# Matikan
if [ "$1" = "off" ]; then
  crontab -l 2>/dev/null | grep -v "$TAG" | crontab - || true
  echo "Auto-update DIMATIKAN."
  exit 0
fi

HOUR="${1:-3}"
if ! [[ "$HOUR" =~ ^[0-9]+$ ]] || [ "$HOUR" -gt 23 ]; then
  echo "Jam tidak valid. Contoh: bash setup-autoupdate-pi.sh 3"
  exit 1
fi

LINE="0 $HOUR * * * cd $DIR && $SCRIPT >> $LOG 2>&1 $TAG"

# Ganti entri lama (jika ada) dengan yang baru
( crontab -l 2>/dev/null | grep -v "$TAG"; echo "$LINE" ) | crontab -

echo "Auto-update AKTIF: setiap hari pukul $(printf '%02d' "$HOUR"):00."
echo "Log tersimpan di: $LOG"
echo "Cek jadwal: crontab -l"
