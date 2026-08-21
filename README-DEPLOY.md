# Grand Aceh Kuliner POS — Panduan Server Lokal (LAN)

Menjalankan **seluruh aplikasi + database di 1 komputer**, lalu POS komputer & Android POS
mengaksesnya lewat WiFi/jaringan toko. Tanpa internet untuk operasional harian.

```
KOMPUTER SERVER (mis. IP 192.168.1.100)
  ├─ MongoDB           (data semua)
  ├─ Backend FastAPI   (port 8001, internal)
  ├─ Frontend + Nginx  (port 80  -> yang dibuka klien)
  └─ WhatsApp service  (opsional, port 3001)
        ▲ WiFi/LAN
  ┌─────┴─────────────────────┐
POS Komputer (browser)   Android POS (APK)
```

---

## 1. Prasyarat

- **Windows:** pasang **Docker Desktop** (aktifkan WSL2). Rekomendasi utama, paling mudah.
- **Raspberry Pi:** wajib **Raspberry Pi OS 64-bit**, pasang Docker + Docker Compose.
  - ⚠️ **MongoDB:** versi 5+ TIDAK jalan di CPU Pi. Untuk Raspberry Pi set `MONGO_IMAGE=mongo:4.4` (lihat langkah 3).
  - ⚠️ **Raspberry Pi 3 (RAM 1GB) sangat terbatas.** Cukup untuk Mongo+backend+frontend outlet kecil,
    tapi fitur WhatsApp (Chromium) berat. **Sangat disarankan Raspberry Pi 4/5 (2GB+).**
- Komputer butuh **internet HANYA saat build pertama** (mengunduh dependency). Setelah itu bisa offline.

## 2. Salin proyek ke komputer server
Salin folder proyek ini (berisi `docker-compose.yml`, `backend/`, `frontend/`, `whatsapp-service/`).

## 3. Siapkan konfigurasi
```bash
# di dalam folder proyek
cp backend/.env.docker.example backend/.env.docker
```
Buka `backend/.env.docker`, lalu isi/ubah:
- `JWT_SECRET` → string acak panjang (WAJIB diganti).
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` → akun owner pertama.
- Kunci AI (opsional): `OPENAI_COMPAT_API_KEY`, `EMERGENT_LLM_KEY`/`GEMINI_API_KEY`.
- `CORS_ORIGINS=*` aman untuk LAN tertutup (tidak terhubung internet).

**Khusus Raspberry Pi**, buat file `.env` di folder proyek:
```
MONGO_IMAGE=mongo:4.4
```

## 4. Jalankan
```bash
docker compose up -d --build          # inti: Mongo + backend + frontend
# (opsional) dengan WhatsApp:
docker compose --profile whatsapp up -d --build
```
Cek status: `docker compose ps` — semua harus `running`.

## 5. Cari IP komputer server
- Windows: `ipconfig` → lihat **IPv4 Address** (mis. `192.168.1.100`).
- Linux/Pi: `hostname -I`.
> Sarankan set **IP statis** di router agar alamat tidak berubah.

## 6. Akses dari klien
- **POS Komputer (browser):** buka `http://192.168.1.100`.
- **Android POS (APK):** buka aplikasi → di layar **Login** tekan **"Pengaturan Server (LAN)"**
  → isi `http://192.168.1.100` → **Simpan & Hubungkan**. (Cukup sekali; tersimpan di perangkat.)

## 7. Build APK Android (Capacitor)
Di komputer dev (bukan server):
```bash
cd frontend
yarn install
yarn build
npx cap sync android
npx cap open android      # build APK dari Android Studio
```
APK tidak perlu tahu IP server saat di-build — alamat diisi saat runtime (langkah 6).
Lihat juga `frontend/README-ANDROID.md`.

## 8. Backup data
Data ada di volume Docker `mongo_data` & `uploads_data`.
```bash
# backup database
docker compose exec mongo mongodump --archive=/data/db/backup.gz --gzip
docker cp $(docker compose ps -q mongo):/data/db/backup.gz ./backup-$(date +%F).gz
```

---

## Tanpa ketergantungan Emergent
Aplikasi yang di-deploy **tidak terhubung ke Emergent**:
- Frontend: alat "visual edits" hanya aktif saat pengembangan (dev), TIDAK ikut di build produksi. Tidak ada skrip telemetri.
- Backend: biarkan `EMERGENT_LLM_KEY` **kosong** di `backend/.env.docker`. AI memakai provider Anda sendiri
  (`OPENAI_COMPAT_*`) atau `GEMINI_API_KEY` Anda. Bila keduanya kosong, fitur AI menampilkan pesan
  "AI belum dikonfigurasi" — bukan menghubungi Emergent.

## Printer (status)
- **Sunmi T2+ (Android):** printer bawaan 80mm, **auto-cut & buka laci kasir** sudah didukung di
  `frontend/src/lib/receipt.js` (fungsi `cutPaper()` & `openDrawer()` lewat SunmiInnerPrinter).
  Berfungsi saat aplikasi berjalan sebagai APK di perangkat Sunmi.
- **Epson (POS Komputer):** dukungan printer struk Epson jaringan (ePOS/port 9100) **belum**
  diimplementasikan — akan ditambahkan pada tahap berikut (butuh IP & model printer untuk diuji di lokasi).

## Troubleshooting
- **Klien tidak bisa buka `http://IP`:** cek firewall Windows (izinkan port 80), pastikan 1 jaringan WiFi.
- **Kamera scan faktur di Android tidak muncul:** gunakan **APK** (kamera native), bukan Chrome via `http://IP`
  (kamera browser hanya jalan di HTTPS/localhost).
- **WhatsApp gagal di Raspberry Pi:** wajar (Chromium berat). Jalankan tanpa profil `whatsapp`,
  atau gunakan Pi 4/5.
