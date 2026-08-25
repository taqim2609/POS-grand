# Panduan Akses Server dari Luar Jaringan (Tailscale)

Server POS Anda berjalan di Raspberry Pi dalam jaringan toko (LAN). Dengan
**Tailscale**, tablet/HP/laptop di lokasi lain bisa mengakses server itu
dengan aman — seolah berada di jaringan yang sama — **tanpa membuka port
router dan tanpa domain**. Cocok untuk internet Telkomsel (CGNAT) yang tidak
mendukung port forwarding.

> Keamanan: hanya perangkat yang login ke akun Tailscale Anda yang bisa
> mengakses server. Login POS (email + password) tetap berlaku seperti biasa.

---

## Ringkasan
1. Pasang Tailscale di **Raspberry Pi** (server).
2. Pasang Tailscale di **setiap perangkat** (tablet kasir cabang lain, HP/laptop owner).
3. Semua login ke **akun Tailscale yang SAMA**.
4. Di aplikasi POS perangkat luar, isi **Alamat Server** dengan IP Tailscale Pi.

Tailscale gratis untuk penggunaan pribadi (hingga 100 perangkat).

---

## Langkah 1 — Pasang Tailscale di Raspberry Pi
SSH ke Pi, lalu jalankan di folder project:

```bash
cd ~/grand-aceh-pos
bash setup-tailscale.sh
```

Skrip akan:
- memasang Tailscale,
- menampilkan **tautan login** → buka di browser, login pakai Google/email
  (ini membuat "tailnet" / jaringan privat Anda),
- menampilkan **IP Tailscale** Pi, contoh: `100.101.102.103`.

Catat IP tersebut (biasanya diawali `100.x`).

> Cek IP kapan saja: `sudo tailscale ip -4`

---

## Langkah 2 — Pasang Tailscale di perangkat lain
Di **tablet kasir cabang lain** dan **HP/laptop owner**:

- **Android/iOS:** pasang aplikasi **Tailscale** dari Play Store / App Store,
  buka, **login dengan akun yang SAMA** seperti di Pi, lalu aktifkan (tombol
  Connect/Toggle jadi hijau).
- **Windows/Mac:** unduh dari https://tailscale.com/download, install, login
  akun yang sama.

Selama Tailscale **aktif (connected)**, perangkat itu bisa menjangkau Pi.

---

## Langkah 3 — Set Alamat Server di aplikasi POS
Di perangkat luar (yang Tailscale-nya sudah aktif):

1. Buka aplikasi POS.
2. Di halaman **Login**, ketuk **"Atur Server Manual (LAN)"**
   (atau menu **Pengaturan Perangkat → Alamat Server**).
3. Isi: `http://100.101.102.103`  ← ganti dengan IP Tailscale Pi Anda.
4. Ketuk **Simpan & Hubungkan**.

Aplikasi akan memuat ulang dan terhubung ke server toko dari mana saja. ✅

> Jika **MagicDNS** diaktifkan di admin Tailscale, Anda bisa memakai
> `http://grandpos` (nama host Pi) daripada mengingat angka IP.

---

## Tips & Troubleshooting
- **Tablet cabang lain harus selalu menyalakan Tailscale** agar tetap
  terhubung ke server. Aktifkan "Always-on"/VPN otomatis bila perlu.
- **Di dalam toko (LAN yang sama)**, tetap gunakan alamat lokal biasa
  (`grandpos.local` atau `http://192.168.x.x`) agar lebih cepat. IP Tailscale
  dipakai hanya saat di luar jaringan.
- Server offline-first: transaksi tetap tersimpan di perangkat saat koneksi
  terputus, lalu tersinkron saat terhubung kembali.
- **Cek status koneksi** di Pi: `tailscale status`
- Jika IP `100.x` tidak bisa diakses: pastikan Tailscale di KEDUA sisi aktif
  dan login akun yang sama; coba `ping 100.x.x.x` dari perangkat luar.

---

## 🌐 OPSI TANPA PASANG APLIKASI TAILSCALE DI HP — Tailscale Funnel

Jika Anda ingin tablet/HP terhubung dari luar jaringan **tanpa memasang
aplikasi Tailscale** (cukup buka lewat browser / APK POS), gunakan
**Tailscale Funnel**. Funnel memberi server POS Anda **URL publik HTTPS**,
mis. `https://grandpos.tailf3a839.ts.net`.

> ⚠️ Konsekuensi keamanan: halaman login POS jadi bisa diakses siapa pun yang
> tahu URL tersebut (data tetap aman karena tetap butuh login email+password).
> Jika ingin akses terbatas ke perangkat pribadi saja, tetap pakai cara
> Tailscale biasa di atas (HP wajib pasang Tailscale).

### Langkah A — Aktifkan Funnel di Raspberry Pi (sekali saja)
SSH ke Pi, lalu:
```bash
cd ~/grand-aceh-pos
bash setup-funnel-pi.sh
```
Skrip akan memandu prasyarat di admin Tailscale (Enable MagicDNS + HTTPS
Certificates, dan izin `funnel` di ACL), lalu menampilkan **URL publik** Anda.

Mematikan Funnel: `sudo tailscale funnel reset`.

### Langkah B — Pakai di aplikasi POS / browser
- **Lewat browser mana pun (tanpa Tailscale):** buka langsung URL publiknya,
  mis. `https://grandpos.tailf3a839.ts.net`.
- **Lewat APK POS:** di halaman **Login**, ketuk tombol **"Koneksi via
  Tailscale"** → alamat sudah terisi otomatis (`https://grandpos.tailf3a839.ts.net`)
  → ketuk **Simpan & Hubungkan**. (Tersedia juga tombol **Tes Koneksi** untuk
  memastikan server terjangkau sebelum login.)

> Di dalam toko (LAN sama) tetap disarankan pakai alamat lokal
> (`http://192.168.x.x` / `grandpos.local`) agar lebih cepat. URL Funnel dipakai
> saat di luar jaringan toko.
