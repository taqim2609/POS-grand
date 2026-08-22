#!/usr/bin/env bash
# ============================================================
# Jadwal MATI OTOMATIS (graceful shutdown) Raspberry Pi.
# Default: mati setiap hari pukul 01:00.
# Pakai:
#   sudo bash setup-power-schedule-pi.sh          # mati 01:00
#   sudo bash setup-power-schedule-pi.sh 1        # mati 01:00
#   sudo bash setup-power-schedule-pi.sh 23       # mati 23:00
#   sudo bash setup-power-schedule-pi.sh off      # batalkan
#
# CATATAN: NYALA otomatis TIDAK bisa via software (Pi tak punya wake-timer).
# Gunakan smart plug / timer colokan yang menyalakan listrik pukul 09:00 —
# Pi akan otomatis booting saat listrik kembali.
# ============================================================
set -e
TAG="# grand-aceh-pos-autoshutdown"

if [ "$(id -u)" -ne 0 ]; then
  echo "Jalankan dengan sudo:  sudo bash setup-power-schedule-pi.sh $*"
  exit 1
fi

if [ "$1" = "off" ]; then
  crontab -l 2>/dev/null | grep -v "$TAG" | crontab - || true
  echo "Auto-shutdown DIBATALKAN."
  exit 0
fi

HOUR="${1:-1}"
if ! [[ "$HOUR" =~ ^[0-9]+$ ]] || [ "$HOUR" -gt 23 ]; then
  echo "Jam tidak valid. Contoh: sudo bash setup-power-schedule-pi.sh 1"
  exit 1
fi

LINE="0 $HOUR * * * /sbin/shutdown -h now $TAG"
( crontab -l 2>/dev/null | grep -v "$TAG"; echo "$LINE" ) | crontab -

echo "Auto-shutdown AKTIF (root cron): mati setiap hari pukul $(printf '%02d' "$HOUR"):00."
echo "Untuk NYALA pukul 09:00, gunakan smart plug / timer listrik (lihat catatan skrip)."
echo "Cek jadwal root: sudo crontab -l"
