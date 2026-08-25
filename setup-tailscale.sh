#!/usr/bin/env bash
# ============================================================
# Setup Tailscale di Raspberry Pi — akses server POS dari luar
# jaringan (aman, tanpa buka port router, tanpa domain).
# Jalankan di Pi:  bash setup-tailscale.sh
# ============================================================
set -e

echo "==> [1/3] Memasang Tailscale ..."
if command -v tailscale >/dev/null 2>&1; then
  echo "    Tailscale sudah terpasang, lewati instalasi."
else
  curl -fsSL https://tailscale.com/install.sh | sh
fi

echo
echo "==> [2/3] Menyalakan Tailscale ..."
echo "    Akan muncul TAUTAN LOGIN. Buka tautan itu di browser (HP/laptop),"
echo "    lalu login pakai Google/email untuk membuat jaringan (tailnet) Anda."
echo
sudo tailscale up --hostname=grandpos

echo
echo "==> [3/3] Selesai! Alamat server untuk perangkat luar:"
IP=$(sudo tailscale ip -4 | head -n1)
echo "    ------------------------------------------------"
echo "    IP Tailscale Pi : $IP"
echo "    Alamat Server   : http://$IP"
echo "    (Jika MagicDNS aktif, bisa juga: http://grandpos)"
echo "    ------------------------------------------------"
echo
echo "Masukkan 'http://$IP' sebagai Alamat Server di aplikasi POS"
echo "pada tablet/HP yang berada di LUAR jaringan toko."
echo "Pastikan perangkat tersebut juga sudah memasang & login Tailscale"
echo "dengan akun yang SAMA."
