#!/usr/bin/env bash
# ============================================================
# Setup Tailscale FUNNEL di Raspberry Pi
# Membuat URL PUBLIK HTTPS untuk server POS, sehingga HP/tablet
# bisa terhubung dari luar jaringan TANPA memasang aplikasi
# Tailscale (cukup buka lewat browser/APK).
#
# Jalankan di Pi:  bash setup-funnel-pi.sh
# ============================================================
set -e

LOCAL_PORT="${1:-80}"   # port frontend (nginx) di host, default 80

echo "==> [1/4] Memastikan Tailscale terpasang ..."
if ! command -v tailscale >/dev/null 2>&1; then
  echo "    Tailscale belum ada. Memasang ..."
  curl -fsSL https://tailscale.com/install.sh | sh
fi

echo
echo "==> [2/4] Memastikan Tailscale menyala (hostname: grandpos) ..."
if ! sudo tailscale status >/dev/null 2>&1; then
  echo "    Akan muncul TAUTAN LOGIN. Buka di browser & login akun Tailscale Anda."
  sudo tailscale up --hostname=grandpos
fi

echo
echo "==> [3/4] Prasyarat di admin Tailscale (SEKALI SAJA):"
echo "    1) https://login.tailscale.com/admin/dns"
echo "         - Enable MagicDNS"
echo "         - Enable HTTPS Certificates"
echo "    2) https://login.tailscale.com/admin/acls  -> tambahkan izin Funnel, contoh:"
cat <<'ACL'
        "nodeAttrs": [
          { "target": ["autogroup:member"], "attr": ["funnel"] }
        ],
ACL
echo "    (Tanpa 2 langkah ini, perintah funnel akan ditolak.)"
echo
read -r -p "Sudah mengaktifkan MagicDNS+HTTPS & izin Funnel di admin? Tekan ENTER untuk lanjut..." _ || true

echo
echo "==> [4/4] Mengaktifkan Funnel -> proxy https publik ke localhost:${LOCAL_PORT} ..."
# Bersihkan konfigurasi serve/funnel lama agar idempoten, lalu set ulang (mode background).
sudo tailscale funnel reset >/dev/null 2>&1 || true
sudo tailscale funnel --bg "${LOCAL_PORT}"

echo
echo "======================================================================"
echo " Funnel AKTIF. Status:"
sudo tailscale funnel status || true
echo "----------------------------------------------------------------------"
HOST=$(sudo tailscale status --json 2>/dev/null | grep -oE '"DNSName":\s*"[^"]+"' | head -n1 | sed -E 's/.*"([^"]+)\.?"/\1/' | sed 's/\.$//')
if [ -n "$HOST" ]; then
  echo " URL PUBLIK server POS Anda:"
  echo "     https://${HOST}"
else
  echo " URL publik: https://grandpos.<nama-tailnet>.ts.net"
fi
echo "======================================================================"
echo
echo "Buka URL di atas dari HP/tablet mana pun (tanpa aplikasi Tailscale),"
echo "atau di aplikasi POS ketuk 'Koneksi via Tailscale' lalu tempel URL itu."
echo
echo "Mematikan Funnel nanti:  sudo tailscale funnel reset"
