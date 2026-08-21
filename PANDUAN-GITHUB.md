# Panduan Instalasi & Update via GitHub — Grand Aceh Kuliner POS

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
- Dari perangkat lain: `http://<IP-server>` (mis. `http://192.168.1.50`) atau `http://pos.local`
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
