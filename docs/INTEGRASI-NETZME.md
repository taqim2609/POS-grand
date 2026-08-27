# Grand Aceh Kuliner POS — Dokumentasi Teknis untuk Integrasi Open API Netzme (QRIS)

- **Dokumen**: Arsitektur Sistem & Alur Pembayaran
- **Versi dokumen**: 1.0
- **Tanggal**: 27 Agustus 2026
- **Disiapkan oleh**: Tim Teknis Grand Aceh Kuliner

---

## 1. Ringkasan Sistem

**Grand Aceh Kuliner POS** adalah sistem kasir (point-of-sale) untuk restoran F&B dan retail
yang berjalan **on-premise** di dalam toko. Sistem ini menangani:
- Transaksi **dine-in**, **take-away**, dan **retail** (kasir, meja, pembayaran)
- Manajemen **produk, stok, kategori, vendor (bagi hasil), member & poin loyalitas**
- **Promo otomatis**, **diskon**, dan **laporan** (harian/mingguan/bulanan, ekspor, kirim WhatsApp)
- **Mode hybrid online/offline** — transaksi tetap berjalan saat internet terputus,
  lalu disinkronkan otomatis saat koneksi pulih.

Saat ini pembayaran yang didukung: **Tunai (cash), QRIS (statis via aplikasi pihak ketiga),
Debit/Kartu**, dan metode pembayaran kustom yang dapat dikonfigurasi admin.

Tujuan integrasi ini: menambahkan **QRIS dinamis (Netzme)** sebagai metode pembayaran
langsung dari sistem kasir — lengkap dengan konfirmasi otomatis dan rekonsiliasi.

---

## 2. Arsitektur Teknis

### 2.1 Stack
| Komponen | Teknologi |
|---|---|
| Frontend (web kasir) | React.js (React 19, Vite/CRA), Tailwind CSS |
| Aplikasi Android (kasir/HP) | Capacitor (WebView) — APK Android, tersedia versi 1.9 |
| Backend / API | Python **FastAPI** (single service), REST JSON |
| Database | **MongoDB** (embedded, berjalan di server yang sama) |
| Server | **Raspberry Pi** (ARM64) di dalam toko, Docker Compose |
| Server web | Nginx (reverse-proxy, satu origin: `http://<IP-server>`) |
| Otomatisasi | Skrip update & backup (lokal + cadangan ke cloud) |

### 2.2 Diagram Arus Data (level tinggi)
```
[Kasir: Web/Android] --> Nginx (80) --> FastAPI (8001) --> MongoDB
                                          |
                                          +--> (Baru) Netzme Open API
                                          |      QRIS dinamis / status check
                                          |
[Pelanggan] --> scan QR (Netzme) --> Netzme (QRIS)
                    ^                              |
                    |                              v
              (Tampil di layar / struk)    Webhook/callback --> FastAPI
                                                       |
                                                       v
                                          Verifikasi + tandai LUNAS di POS
```

### 2.3 Karakteristik Jaringan
- **On-premise** di jaringan LAN toko; akses keluar internet tersedia (untuk integrasi API).
- Opsional akses jarak jauh via **Tailscale** (jaringan privat terenkripsi) atau **Funnel**
  (HTTPS publik) untuk kebutuhan webhook callback dari luar.
- Server memiliki koneksi internet untuk: update aplikasi, notifikasi WhatsApp, dan
  (nanti) panggilan API Netzme.

---

## 3. Alur Pembayaran (Sebelum & Sesudah Integrasi)

### 3.1 Alur pembayaran saat ini
1. Kasir menyusun item di keranjang (dine-in/take-away/retail).
2. Kasir memilih metode pembayaran (Tunai / QRIS / Debit).
3. Untuk **QRIS**: kasir menampilkan QR statis merchant (dari penyedia QRIS),
   pelanggan memindai & membayar lewat aplikasi e-wallet/m-banking.
4. Kasir **memeriksa manual** bukti pembayaran pelanggan (layar HP pelanggan), lalu
   menandai transaksi **LUNAS** di POS.
5. Struk dicetak (printer thermal Sunmi / browser / Epson).

> Keterbatasan saat ini: tidak ada **konfirmasi otomatis** dan tidak ada
> **rekonsiliasi otomatis** — pembayaran QRIS bergantung pengecekan manual kasir.

### 3.2 Alur pembayaran dengan QRIS Dinamis Netzme (target)
1. Kasir menyelesaikan item di keranjang → memilih **QRIS (Netzme)**.
2. POS memanggil Netzme **generate QRIS dinamis** (nominal transaksi, referensi unik).
3. QR ditampilkan di **layar kasir** (modal besar) dan/atau **dicetak di struk**.
4. Pelanggan memindai QR → membayar via e-wallet/m-banking.
5. **Netzme mengirim webhook/callback** ke server POS (atau POS melakukan status check).
6. POS memverifikasi (signature/status) → otomatis menandai transaksi **LUNAS**,
   mencatat referensi pembayaran Netzme, dan mencetak struk.
7. **Rekonsiliasi**: laporan transaksi Netzme dicocokkan dengan transaksi POS secara
   otomatis (status, nominal, referensi).

---

## 4. Kebutuhan Integrasi (detail)

| # | Kebutuhan | Keterangan |
|---|---|---|
| 1 | **Generate QRIS Dinamis** | Membuat QR per transaksi dengan nominal spesifik + referensi unik (order number POS), masa berlaku singkat |
| 2 | **Notifikasi real-time (webhook)** | Netzme mengirim callback ke URL server toko saat pembayaran berhasil |
| 3 | **Status check / polling** | Endpoint untuk mengecek status transaksi — cadangan bila webhook terlewat |
| 4 | **Rekonsiliasi otomatis** | Laporan/cocokkan transaksi bayar (nominal, ref, status) untuk audit |
| 5 | **Sandbox** | Lingkungan uji coba sebelum produksi |
| 6 | **Signature/keamanan** | Verifikasi callback (signature/hash) untuk mencegah pemalsuan |

---

## 5. Persyaratan Teknis ke Netzme

Agar tim kami dapat mengimplementasikan, mohon disediakan:
1. **Dokumen spesifikasi Open API** (endpoint, request/response, autentikasi, sandbox URL).
2. **Akun sandbox** + **API Key/Secret** (untuk pengembangan).
3. **Contoh format webhook/callback** + mekanisme verifikasi (signature).
4. **Daftar kode status transaksi** (sukses, gagal, kedaluwarsa, dll.).
5. Informasi **batas waktu (timeout) QRIS dinamis** dan kebijakan pembatalan.

---

## 6. Kesiapan Tim Teknis

- **Sistem sudah siap menerima integrasi**: backend berbasis REST (FastAPI) sehingga
  menambah endpoint dan layanan baru bersifat modular.
- **Webhook receiver dapat disediakan** (endpoint publik via Nginx; bila perlu diakses
  dari internet, kami memakai Tailscale Funnel — URL `https://grandpos.tailf3a839.ts.net`).
- **Rekonsiliasi**: MongoDB menyimpan riwayat lengkap transaksi; mudah dicocokkan
  dengan payload Netzme.
- **Tim teknis** dapat melakukan pengembangan di sandbox tanpa mengganggu operasional
  toko (mode hybrid memastikan POS tetap berjalan).

---

## 7. Kontak

| | |
|---|---|
| Nama | [Nama Lengkap] |
| Jabatan | [Posisi / Jabatan] |
| No. HP / WhatsApp | [08xx…] |
| Email | [email@example.com] |
| Alamat toko | [Alamat lengkap] |

---

*Dokumen ini dapat diperbarui bila ada informasi tambahan dari tim Netzme.*
