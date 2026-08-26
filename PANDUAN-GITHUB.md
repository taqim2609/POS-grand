# Panduan Instalasi & Update — Grand Aceh Kuliner POS

> **Catatan: alur resmi sekarang memakai vibecoder.co.id, bukan GitHub.**
> Lihat **PANDUAN-UPDATE-VIBECODER.md** (instal & update dari
> `https://taqim258.vibecoder.co.id/pos-grand-update/` — tanpa git pull).
> Panduan di bawah ini disimpan hanya untuk referensi/alur lama.

Aplikasi ini di-install dan di-update **sepenuhnya dari GitHub**. Tidak perlu lagi
menyalin folder secara manual atau mengunduh ZIP.

- **Repository:** `https://github.com/taqim2609/POS-grand.git`
- **Folder di server (hasil clone):** `~/grand-aceh-pos`

> Sebelum mulai: pastikan kode terbaru sudah ada di GitHub (pakai tombol **Save to Github**
> di dalam aplikasi Emergent) dan repo berstatus **publik** agar bisa di-clone tanpa login.
> Jika default branch repo bukan `main` (mis. `master`), ganti `/main/` pada URL menjadi `/master/`.

---

## 1. Install di Raspberry Pi (headless, via SSH) — 1 perintah

Masuk ke Pi via SSH, lalu jalankan:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/taqim2609/POS-grand/main/bootstrap-pi.sh)
```

Perintah ini otomatis:
1. Memasang **git** dan **Docker** (butuh internet sekali ini saja).
2. `git clone` repo ke `~/grand-aceh-pos` (atau `git pull` bila sudah ada).
3. Menjalankan installer: membuat `backend/.env.docker`, membuka editor untuk mengisi
   **JWT_SECRET**, **email/password admin**, dan **kunci AI**. Simpan (Ctrl+O, Enter, Ctrl+X di nano).
4. Build & menjalankan semua container.

Setelah selesai, **reboot sekali** agar Docker bisa dipakai tanpa `sudo`:

```bash
sudo reboot
```

### Alternatif manual (jika sudah punya git)
```bash
git clone https://github.com/taqim2609/POS-grand.git ~/grand-aceh-pos
cd ~/grand-aceh-pos
chmod +x bootstrap-pi.sh
./bootstrap-pi.sh
```

---

## 2. Install di Komputer Windows

Prasyarat: pasang **Docker Desktop** (aktifkan WSL2) dan **Git for Windows**.

**Cara termudah:** unduh `bootstrap-windows.bat` dari aplikasi (Pengaturan → Installer),
lalu **dobel-klik**. Skrip otomatis: cek git+Docker → `git clone` repo → jalankan installer.

**Atau manual** di PowerShell / CMD:
```bat
git clone https://github.com/taqim2609/POS-grand.git grand-aceh-pos
cd grand-aceh-pos
install-windows.bat
```

---

## 3. Update ke versi terbaru (dari GitHub)

**Raspberry Pi:**
```bash
cd ~/grand-aceh-pos && ./update-pi.sh
```

**Windows:**
```bat
cd grand-aceh-pos
update-windows.bat
```

Update otomatis `git pull` + build ulang + restart. **Data Anda tetap aman**
(tersimpan di volume Docker, tidak terhapus saat update).

---

## 4. Mengakses aplikasi dari perangkat lain

Pastikan semua perangkat di **WiFi yang sama**, lalu buka browser:

- Dari server sendiri: `http://localhost`
- Dari perangkat lain: `http://<IP-server>` (mis. `http://192.168.1.50`) atau `http://grandpos.local`
- Cari IP Pi: jalankan `hostname -I` di SSH. Atau pakai tombol **"Cari Server Otomatis"** di layar Login.

---

## 5. Backup & Restore

**Dari aplikasi:** Pengaturan → Installer → **Backup Sekarang** (unduh `.zip` seluruh data) /
**Restore dari File**.

**Dari skrip (dalam folder proyek):**
```bash
cd ~/grand-aceh-pos
./backup-pi.sh                        # backup -> folder backups/
./restore-pi.sh backups/namafile.gz   # pulihkan (ketik YA)
./setup-autobackup-pi.sh              # backup otomatis tiap malam 23:00
```

> **Perhatian:** restore MENIMPA seluruh data saat ini. Simpan salinan backup ke flashdisk/cloud.

---

## 6. Restart server

```bash
cd ~/grand-aceh-pos && ./restart-pi.sh      # Pi
```
Windows: dobel-klik `restart-windows.bat` di dalam folder proyek.

---

## Ringkasan alur

1. Push kode ke GitHub (Save to Github) — repo publik.
2. Pi: jalankan 1 perintah bootstrap → install otomatis.
3. Isi `backend/.env.docker` saat editor terbuka, simpan.
4. Reboot Pi sekali.
5. Akses `http://IP-server`.
6. Update kapan saja: `cd ~/grand-aceh-pos && ./update-pi.sh`. Backup rutin.

---

## 7. Aplikasi Android dengan Update Otomatis (OTA via Pi)

APK Android bisa memperbarui tampilannya sendiri dari server Pi (LAN) tanpa
Play Store & tanpa reinstall. Server menyajikan paket update di:
`http://grandpos.local/ota/version.json` dan `/ota/bundle.zip` (otomatis dibuat
saat build frontend).

### Cara kerja
1. Update Pi seperti biasa (`git pull` + rebuild / tombol Update 1-klik) → Pi punya `ota/` versi baru.
2. APK saat dibuka cek `grandpos.local/ota/version.json`; jika beda, unduh `bundle.zip` dari Pi & pasang live.
3. Selesai — tampilan baru muncul, tanpa reinstall APK.

### Build APK (sekali saja, di komputer — BUKAN di Pi)
**Prasyarat (install di komputer Windows/Mac Anda):**
- **Node.js 20/22/24** (LTS) — https://nodejs.org
- **Java JDK 17** — biasanya sudah termasuk di Android Studio (Embedded JDK)
- **Android Studio** + **Android SDK API 35** (Android 15). Pasang via *Tools → SDK Manager → SDK Platforms → centang Android 15 (API 35)*.

**Langkah:**
```bash
git clone https://github.com/taqim2609/POS-grand.git
cd POS-grand/frontend
yarn install
REACT_APP_BACKEND_URL="" yarn build
npx cap sync android
npx cap open android
```
> `REACT_APP_BACKEND_URL=""` dikosongkan agar APK memakai alamat server yang
> Anda isi sendiri saat pertama buka aplikasi. Di **CMD** pakai `set REACT_APP_BACKEND_URL=`
> lalu `yarn build`. Di **PowerShell** pakai `$env:REACT_APP_BACKEND_URL=""; yarn build`.

Di **Android Studio**:
1. Tunggu **Gradle Sync** selesai (klik ikon gajah 🐘 bila perlu). Jika minta
   download **SDK API 35**, klik *Install missing SDK* → Accept.
2. Menu **Build → Build Bundle(s)/APK(s) → Build APK(s)**.
3. Setelah "APK generated successfully", klik **locate**. File ada di:
   `frontend/android/app/build/outputs/apk/debug/app-debug.apk`
4. Kirim `app-debug.apk` ke HP/tablet → Install (izinkan "sumber tidak dikenal").

> Konfigurasi native sudah disiapkan di repo (minSdk 23, compileSdk 35, path aset
> relatif untuk OTA). Jadi cukup ikuti langkah di atas.

### Kalau muncul error saat build (sudah diperbaiki di repo, ini untuk referensi)
- **`proguard-android.txt no longer supported`** → sudah diganti ke `-optimize` di repo.
- **`minSdkVersion 22 cannot be smaller than 23`** → minSdk sudah 23 di repo.
- **`compile against version 35 ... currently android-34`** → compileSdk sudah 35 di repo; pasang SDK API 35 (lihat prasyarat).
- **`cordova.variables.gradle not found`** → jalankan `npx cap sync android` dulu.
- Jika error cache: **Build → Clean Project** lalu **Rebuild Project**.

> APK cukup dibuat 1x. Update tampilan berikutnya otomatis via OTA. Build APK lagi
> hanya jika ada perubahan native (ganti ikon/plugin) — jarang.

---

## 🤖 Build Frontend Otomatis (GitHub Actions) — TIDAK PERLU `yarn build` MANUAL LAGI

Sekarang repo punya robot otomatis: `.github/workflows/build-frontend.yml`.

**Cara kerja:** setiap kali Anda push perubahan kode frontend (mis. lewat tombol
"Save to Github"), GitHub akan **otomatis menjalankan `yarn build` di cloud** lalu
**commit ulang folder `frontend/build/`** ke repo. Jadi:

- ✅ Anda cukup: **edit kode → Save to Github**. Selesai.
- ✅ Tidak perlu lagi menjalankan `yarn build` manual sebelum push.
- ✅ Raspberry Pi tetap ringan (ambil `frontend/build/` yang sudah jadi via `./update-pi.sh`).
- ✅ Tanpa setup apa pun — pakai token bawaan GitHub (gratis untuk repo Anda).

**Alur update di Pi setelah push:**
1. Edit kode → **Save to Github**.
2. Tunggu ± 1–2 menit sampai tab **Actions** di GitHub selesai (centang hijau) —
   inilah yang meng-commit `frontend/build/` terbaru.
3. Di Pi jalankan: `cd ~/grand-aceh-pos && ./update-pi.sh`.

> Catatan: jika di Pi Anda menjalankan `./update-pi.sh` TEPAT setelah push tetapi
> SEBELUM Actions selesai, `git pull` belum berisi build terbaru. Tunggu centang
> hijau di tab **Actions** dulu, baru jalankan `./update-pi.sh`.
