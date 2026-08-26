# Panduan Update Server via vibecoder.co.id (pengganti git pull)

Mulai sekarang server Pi **tidak perlu lagi menarik kode dari GitHub**.
Cukup unduh dari **vibecoder.co.id** — alamatnya sudah disiapkan:

- **Update Center:** `https://taqim258.vibecoder.co.id/pos-grand-update/`
- **Arsip kode:** `pos-grand.tar.gz` (berisi seluruh kode terbaru + build + OTA)

Versi dikenali dari hash git (mis. `76db1aa`). Bila versi remote sama dengan
versi terpasang, skrip update **tidak melakukan apa-apa** (tidak unduh, tidak rebuild).

---

## 1. Alihkan Pi ke mode vibecoder (cukup SEKALI)

Masuk ke Pi via SSH, lalu:

```bash
cd ~/grand-aceh-pos
curl -fsSL https://taqim258.vibecoder.co.id/pos-grand-update/update-vibecoder-pi.sh -o update-vibecoder-pi.sh
chmod +x update-vibecoder-pi.sh
./update-vibecoder-pi.sh
```

Yang terjadi otomatis:
1. Cek versi terbaru di vibecoder.co.id.
2. Mengunduh `pos-grand.tar.gz` → diekstrak **di tempat** (file `.env`,
   `backend/.env.docker`, `backups/`, `.git` TIDAK disentuh).
3. `docker compose up -d --build` → semua container versi baru.
4. Mencatat versi di file `.vibecoder-version`.

Setelah langkah ini, `update-pi.sh` dan auto-update harian otomatis memakai jalur vibecoder.

## 2. Update manual berikutnya

```bash
cd ~/grand-aceh-pos && ./update-vibecoder-pi.sh
```

## 3. Auto-update harian (cron) — tetap jalan

Karena `check-update-pi.sh` sudah otomatis memakai mode vibecoder saat
`.vibecoder-version` ada, jadwal cron yang sudah terpasang tetap berfungsi.
Kalau mau atur ulang jam/notifikasi WA:

```bash
bash setup-autoupdate-pi.sh 3 62811687783    # tiap hari 03:00 + notif WA
bash setup-autoupdate-pi.sh off              # matikan
```

## 4. Tombol "Update Sekarang" (1-klik di aplikasi)

Backend sudah disesuaikan: bila folder ada `.vibecoder-version`, tombol ini
mengunduh dari vibecoder.co.id (dengan pengecekan versi); kalau tidak, kembali
ke mode git lama. Tidak perlu konfigurasi tambahan.

## 5. Cek versi yang terpasang

```bash
cat ~/grand-aceh-pos/.vibecoder-version
```

## 6. Balik ke mode GitHub (jika suatu saat mau)

```bash
cd ~/grand-aceh-pos
rm -f .vibecoder-version
./update-pi.sh        # kembali memakai git pull
```

---

## Cara kerja rilis versi baru

Setiap ada kode baru (termasuk build frontend & bundle OTA untuk APK),
versi baru dipublikasikan ulang ke alamat yang sama di atas oleh VibeCoder
(dari workspace vibecoder.co.id). Anda di sisi Pi cukup menjalankan
`./update-vibecoder-pi.sh` (atau biarkan auto-update) — tidak perlu menyentuh GitHub.
APK Android yang terhubung ke server ini ikut menerima update OTA dari server,
seperti biasa.
