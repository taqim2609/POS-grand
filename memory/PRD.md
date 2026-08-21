# Grand Aceh Kuliner POS — PRD

## Problem statement
POS hybrid F&B + retail untuk Grand Aceh Kuliner. POS komputer (web) + POS Android (landscape), server hybrid lokal + sinkronisasi cloud agar operasional tetap jalan saat internet bermasalah. Bahasa: Indonesia.

## Stack & architecture
- FastAPI + MongoDB (motor), React + Tailwind + Shadcn UI, PWA offline (Service Worker).
- Custom JWT bearer auth (bcrypt), token in localStorage. WIB (UTC+7) untuk semua batas hari/laporan/shift.
- Atomic MongoDB counters untuk nomor order unik. Offline queue idempoten via client_ref.

## Core modules (DONE)
- Auth (login, /auth/me), Users CRUD (admin), roles admin/kasir.
- POS: dine-in (open bill + meja), take-away, retail; kategori/produk/meja; diskon; pembayaran cash/QRIS/debit.
- Inventory (pembelian, opname), Kas (cash flow), Shift, Transaksi (void/refund).
- Offline-first: cache master data, antrean sinkron, riwayat sinkron, auto-clear, cetak ulang struk (EKS-OFFLINE).
- Struk 80mm Sunmi (JS bridge + fallback print via Blob URL, XSS-escaped).
- Import/Export produk Excel.

## Build 2 (2026-06)
- Pengaturan AI PER-FUNGSI (Deskripsi/Gambar/Analisis): Base URL/API Key/Model masing-masing; endpoint GET/PUT /api/settings/ai; cek sisa kredit GET /api/settings/ai/credit; image gen OpenAI-compatible hanya bila dikonfigurasi (else Gemini/Emergent).
- Ambang stok menipis per-produk (ProductIn.min_stock, default 10); Dashboard low-stock pakai ambang per-produk.
- Grafik tren penjualan mingguan/bulanan (Dashboard, /reports/range).
- Margin profit per produk di laporan (/reports/summary top_products: cost/profit/margin).
- Validasi tanggal wib_day_range (400). KPI "Rata-rata per Order".

## Build 8 (2026-06) — WhatsApp Web (whatsapp-web.js), Twilio dihapus
- Twilio DIHAPUS total (kode + env). WhatsApp kini via layanan Node **whatsapp-web.js** (login QR, nomor sendiri, gratis) + bisa **chat**.
- Layanan: `/app/whatsapp-service` (Express + whatsapp-web.js + qrcode), jalan via supervisor program `whatsapp` di port 3001, pakai Chromium sistem (`CHROME_BIN=/usr/bin/google-chrome`, LocalAuth persist di `.wwebjs_auth`). Env: WA_SERVICE_URL, WA_SECRET di backend/.env.
- Backend proxy (admin): GET /api/whatsapp/status (ready+qr), /chats, /messages?chatId=, POST /send, /logout. `_send_whatsapp` & laporan terjadwal kini lewat layanan ini.
- Frontend: halaman **WhatsApp** (nav admin) — scan QR + daftar chat + kirim/terima pesan. SettingsReport diarahkan ke menu WhatsApp (bukan Twilio).
- Verified: layanan up, Chromium launch OK, QR ter-generate & lolos via proxy (`qr present: True`), 3 service RUNNING, frontend compiled. Scan QR & chat live TIDAK bisa diuji agent (butuh HP user).

## CATATAN PENTING WhatsApp Web
- Tak resmi (risiko blokir nomor). Andal di preview/server lokal (Raspberry Pi/PC toko); **produksi Emergent kemungkinan tidak menjalankan layanan Node ini** (supervisor conf di /etc/supervisor/conf.d tidak ikut deploy). Untuk produksi, jalankan layanan di server lokal outlet.

## Build 7 (2026-06) — Ekspor, Laporan Terjadwal & WhatsApp
- Ekspor laporan: `GET /api/reports/export/excel` & `/pdf` (openpyxl + fpdf2). Tombol Excel/PDF di Dashboard (unduh via blob).
- WhatsApp (Twilio): `POST /api/reports/send-whatsapp` kirim laporan teks (total, per kategori, metode bayar, produk terlaris, + analisis AI opsional). Tombol "Kirim WhatsApp" di Dashboard.
- Pengaturan Laporan & WA (tab baru di Pengaturan): aktif/nonaktif, jam kirim (WIB), daftar nomor, sertakan AI. `GET/PUT /api/settings/report`.
- Laporan terjadwal: cron `.emergent/crons.yml` (hourly `0 * * * *`) → `POST /api/cron/daily-report` (auth WEBHOOK_CRON_SECRET, ack cepat + background). Job cek jam WIB == jam setelan & idempoten per hari (last_sent_date).
- Env baru di backend/.env: WEBHOOK_CRON_SECRET (terisi), TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_FROM (kosong — diisi user).
- Verified via curl: excel 200, pdf 200 (%PDF), settings GET/PUT, send-whatsapp 400 saat Twilio belum diisi, cron 401 tanpa secret / 200 dengan secret, crons.yml valid.

## KETERGANTUNGAN USER (WhatsApp)
- Isi TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (mis. `whatsapp:+14155238886` sandbox) di backend/.env agar kirim WA aktif. Sebelum diisi, tombol/kirim WA mengembalikan 400 "WhatsApp belum dikonfigurasi".

## Build 6 (2026-06) — Kasir & laporan besar
- Barcode/SKU di POS tab Retail: ketik/scan kode + Enter → produk masuk keranjang (match SKU client-side); tidak ketemu → toast error. Hanya tab Retail.
- Input pembelian via FOTO faktur (AI vision): `POST /api/ai/parse-invoice` (fitur AI 'vision', gagal → 400 agar detail lolos ingress). UI di Persediaan > Pembelian > "Scan Faktur (AI)": unggah/foto → baca AI → daftar item editable → cocokkan ke produk retail / buat baru / lewati → simpan (bulk purchase + auto-create produk).
- Dashboard dipindah ke urutan teratas sidebar.
- Laporan per kategori di Dashboard (`category_report`): grup Makanan & Minuman dengan rincian tiap kategori + Retail digabung.
- Menu "Pengaturan" (admin) dengan sub-tab: Pengguna, Meja, Pengaturan AI, Reset Data (menggantikan item terpisah).
- POS wajib buka shift dulu: gate inline "Buka Shift + Kas Awal" di layar POS; offline diizinkan.
- Fix: apiError abaikan body HTML (Cloudflare) → pesan generik.
- Verified: testing agent iteration_8 frontend 100% (7/7 flow), backend 93% (sisa gagal = key AI invalid + test lama usang).
- Laporan AI ditingkatkan: `POST /api/reports/ai-summary` kini menyusun laporan lengkap (per kategori makanan/minuman, retail, laba kotor, kas, stok menipis, produk terlaris) + tombol Salin di panel "Laporan AI" Dashboard. Butuh key AI 'summary' valid.

## Build 5 (2026-06) — Android (Capacitor) + PWA/APK
- PWA manifest ditingkatkan (id, description, lang, categories, display_override, ikon any+maskable) + `/.well-known/assetlinks.json` placeholder untuk TWA. Siap PWABuilder.
- Capacitor 6 di-setup di /app/frontend (core/cli/android 6.2.1); platform Android digenerate di `frontend/android/` (Gradle project lengkap). appId `host.emergent.hybridposaceh`, orientasi landscape terkunci, minSdk 22/SDK 34. Aset di-bundle dari `build/` (dibuild dengan REACT_APP_BACKEND_URL=produksi).
- Panduan build: `frontend/README-ANDROID.md` (buka di Android Studio → Build APK; + langkah plugin printer Sunmi native).
- Catatan: cetak Sunmi native butuh plugin Capacitor tambahan (fallback print aktif tanpa plugin). Preview .env tidak diubah.

## Build 4 (2026-06) — Reset Data (admin)
- POST /api/admin/reset-data { scope: 'transactions'|'all', password } — admin-only; verifies admin password; wipes transactional (+catalog if 'all'); KEEPS users, settings, payment_methods.
- Frontend page /settings-data ('Reset Data' nav, admin): pilih cakupan + ketik "RESET" + password admin. Guards: kasir 403, wrong pw 400 (curl-verified).

## Build 3 (2026-06) — Password management
- POST /api/auth/change-password (self, verify current, min 6).
- POST /api/users/{uid}/reset-password (admin-only, min 6).
- Frontend: "Ganti Password" (semua role, sidebar) + "Reset Password" per user (admin, Pengguna).
- Verified: testing agent iteration_7 frontend 100% (4/4, 6/6 validasi); backend curl (400/403 sesuai).

## Code review fixes (2026-06)
- receipt.js: document.write -> Blob URL (XSS hardening).
- eslint exhaustive-deps: justifikasi disable pada efek mount/filter (Products/Orders/Tables/Users/Shift/POS).
- .gitignore: hapus blok .env agar file env aman-deploy ikut ter-deploy.

## AI AKTIF (2026-06)
- Provider https://www.chenzk.top/v1 (agregator; daftar model berubah-ubah tiap request).
- Model per-fitur: teks/analisis/deskripsi = `deepseek-v4-flash` (key ...GkcQ). Image-gen = `gpt-image-2` (key ...GkcQ).
- VISION (Scan Faktur) DIPERBAIKI 2026-06-21: key ...F3Q3JdU (sk-jnW9v...) + model `claude-sonnet-5`. Verified via URL publik ~7dtk, parsing sempurna, tanpa 502. Provider chenzk.top TIDAK punya model vision di key ...GkcQ; gpt-5.x bisa vision tapi lambat 26-252dtk (sering 502) → dihindari. claude-sonnet-5/4-6 (key ...JdU) tercepat (~5-7dtk).
- Backlog AI: simpan gambar AI sebagai aset lokal (URL provider bisa kadaluarsa).
- 2026-06-21 Scan Faktur → Pembelian Massal: alur 2 langkah (Edit/cocokkan → KONFIRMASI ringkasan → simpan). Endpoint atomik `POST /api/purchases/bulk` (items: existing product_id ATAU create_new+name+category_id+price; validasi semua dulu baru tulis; auto-buat produk retail SKU AI-xxxx; increment stok; return {saved, created_products, total_cost, items}). Frontend InvoiceScan (Inventory.jsx) pakai state `step` edit/confirm; testid: invoice-confirm-btn, invoice-confirm-panel, invoice-back-btn, invoice-save-btn, invoice-grand-total. Verified curl + UI e2e (total Rp105.000 tampil benar).

## PERBAIKAN 2026-06-21 (batch 2)
- SIMPAN GAMBAR AI LOKAL: `_save_image_local(src)` (server.py) decode base64/download URL → tulis ke UPLOAD_DIR (env UPLOAD_DIR, default backend/uploads) → return `/api/uploads/{id}.ext`. Route `GET /api/uploads/{fname}` (FileResponse). ai_image kini return path lokal stabil (tak kadaluarsa). Verified: data-url & remote URL tersimpan; GET 200 image/png via localhost & URL publik (ingress meneruskan /api/*). CATATAN: image gen provider (gpt-image-2) sedang 503 model_not_found — masalah provider terpisah; simpan-lokal aktif begitu gambar berhasil dibuat.
- CEGAH KATEGORI DUPLIKAT: create/update_category cek nama (case-insensitive, per type) → 400 "sudah ada". Verified.
- CORS KETAT: backend/.env CORS_ORIGINS = preview + prod host; kode strip+filter. Verified di localhost:8001 (allowed → ACAO echo; evil → tanpa ACAO). Via URL publik proxy preview tetap tampil `*` (override proxy), tapi backend enforce benar untuk prod/Pi.

## DEPLOYMENT LOKAL / LAN (2026-06-21) — Fase 1
- Target: 1 komputer server (Windows / Raspberry Pi 64-bit) jalankan Mongo+backend+frontend(+WA opsional); klien (POS komputer browser + Android APK) akses via IP LAN. LAN-only, DB mulai kosong.
- Paket Docker: /app/docker-compose.yml (services mongo/backend/whatsapp[profile]/frontend; volumes mongo_data/uploads_data/wa_auth), backend/Dockerfile (python3.11 + emergentintegrations), frontend/Dockerfile (node build → nginx serve, nginx proxy /api→backend:8001 satu origin), whatsapp-service/Dockerfile (chromium + CHROME_BIN), backend/.env.docker.example, README-DEPLOY.md (panduan Windows/Pi, MONGO_IMAGE=mongo:4.4 utk Pi, backup, APK, troubleshooting).
- ALAMAT SERVER RUNTIME: frontend/src/lib/api.js kini baca `localStorage.gak_server_url` dulu (fallback REACT_APP_BACKEND_URL, lalu relatif /api). getServerUrl/setServerUrl. Login.jsx punya panel "Pengaturan Server (LAN)" (testid server-config-toggle/panel, server-url-input, server-url-save) → APK/browser bisa arahkan ke IP server tanpa rebuild. Verified: compose valid, login render + panel muncul, app tetap kompilasi.
- PRINTER (belum): Sunmi T2+ cut+laci SUDAH ada di receipt.js (cutPaper/openDrawer). Epson jaringan (POS komputer, ePOS/9100) BELUM — fase berikut, butuh IP/model printer & uji di lokasi.

## PENGATURAN PERANGKAT (2026-06-21) — /device
- Halaman `pages/DeviceSettings.jsx` (rute /device, semua role: admin/kasir/input; nav "Perangkat" ikon Printer). Config PER-PERANGKAT di localStorage `gak_device_cfg` via `lib/device.js` (getDeviceConfig/setDeviceConfig).
- Isi: Identitas Outlet (nama/alamat/footer struk), Printer (mode auto|sunmi|epson|browser, IP+port Epson, toggle buka laci kasir), Alamat Server LAN (getServerUrl/setServerUrl + reload). Tombol Simpan + Cetak Struk Uji (sampleOrder).
- `lib/receipt.js` di-refactor: baca deviceConfig → header/footer outlet dinamis; mode routing. Sunmi (cutPaper + openDrawer bergantung cashDrawer). EPSON jaringan via ePOS-Print HTTP (`printViaEpson`: POST XML SOAP ke http://IP:port/cgi-bin/epos/service.cgi, <cut>+<pulse drawer>); fallback browserPrint bila gagal. Browser fallback tetap ada. Verified UI via screenshot (kasir). CATATAN: Epson & Sunmi cetak sesungguhnya belum diuji (butuh hardware); ePOS-Print harus diaktifkan di printer Epson.

## TANPA EMERGENT (2026-06-21)
- Frontend: `@emergentbase/visual-edits` hanya di-load saat isDevServer (craco.config.js), TIDAK ikut build produksi; index.html tanpa telemetri. Jadi app deploy = 0 koneksi Emergent di frontend.
- Backend: fallback Emergent di `_gemini_text`, `_gemini_image`, `_get_chat` kini dipagari `if not EMERGENT_LLM_KEY: raise HTTPException(400, "AI belum dikonfigurasi...")`. Import emergentintegrations yang tak terpakai di ai_summary dihapus. Dengan EMERGENT_LLM_KEY kosong di .env.docker → AI HANYA pakai provider user (OPENAI_COMPAT_*) / GEMINI_API_KEY; tak pernah menyentuh Emergent. Verified: AI description hit provider chenzk (bukan Emergent). README-DEPLOY punya bagian "Tanpa ketergantungan Emergent".
- CATATAN: provider chenzk.top agregator intermiten (model list berubah tiap request; deepseek-v4-flash kadang 503 model_not_found). Pertimbangkan ganti model teks ke gpt-5.5/claude-sonnet-5 (key sk-jnW9v) bila sering gagal.

## INSTALLER + UPDATE 1-KLIK (2026-06-21)
- Skrip root: install-windows.bat, install-pi.sh, update-windows.bat, update-pi.sh. Install: cek Docker, copy .env.docker, ARM→mongo:4.4, compose up --build. install-pi.sh headless: auto buka $EDITOR/nano/vi bila .env.docker belum diisi (grep GANTI_DENGAN_ACAK). Update: git pull --ff-only (bila .git) + docker compose up -d --build + image prune (data aman di volume).
- Pengaturan → tab "Installer" (SettingsInstaller.jsx): Bagian 1 Instal Server (pilih Desktop Windows / Raspberry Pi headless), Bagian 2 Perbarui Server (update Desktop / Pi). Semua skrip embedded di lib/installers.js (Blob download). testid: download-windows-installer, download-pi-installer, download-update-windows, download-update-pi. Verified bash -n (root+embedded) & UI screenshot.

## BACKUP & PANDUAN LENGKAP (2026-06-21)
- Skrip root: backup-windows.bat, backup-pi.sh, restore-windows.bat, restore-pi.sh. Backup: docker compose exec -T mongo mongodump --archive --gzip > backups/gak-backup-<TS>.gz (Pi auto-hapus >30 hari). Restore: mongorestore --archive --gzip --drop < file (konfirmasi "YA"). Data di volume mongo_data.
- Tab Installer (SettingsInstaller.jsx) diperluas: bagian Prasyarat (pasang Docker Windows/Pi + perintah, jaringan/IP statis), 1 Instal (Desktop/Pi), 2 Update, 3 Backup&Restore (4 tombol), Ringkasan alur. Semua skrip embedded di lib/installers.js (7 skrip). testid tambahan: download-backup-windows/-pi, download-restore-windows/-pi. Verified bash -n (root+embedded) & UI screenshot; icons DatabaseBackup/ListChecks ada; compiled successfully.

## UNDUH FOLDER PROYEK (2026-06-21)
- Endpoint `GET /api/installers/project-zip` (admin) → zip PROJECT_ROOT (ROOT_DIR.parent) via zipfile in-memory, top folder "grand-aceh-pos/". Exclude dirs: node_modules/.git/build/__pycache__/venv/uploads/backups/.wwebjs_*/.emergent/dist/.pytest_cache/test_reports/memory/.gradle/.idea/.vscode/coverage. Exclude files: .env/.env.docker/.env.local/.DS_Store (rahasia). Guard: 404 bila docker-compose.yml tak ada di root (hindari walk / di container backend prod).
- Frontend: tombol "Unduh grand-aceh-pos.zip" di tab Installer (testid download-project-zip) via api.get blob. Verified: http 200 application/zip 2.6MB/228 entri; tanpa .env/node_modules/.git; compiled successfully.

## CARI SERVER OTOMATIS (2026-06-21)
- Backend: `GET /api/health` publik → {"app":"gak-pos","ok":true} (untuk deteksi server).
- Frontend api.js: `discoverServer(onProgress)` memindai PARALEL kandidat: current origin + mDNS (pos.local/grandaceh.local/raspberrypi.local) + IP umum (192.168.1/0/100, 10.0.0 → oktet 1/2/10/11/100/200/50); probe `${base}/api/health` timeout 1.5s; first valid wins → setServerUrl + reload.
- Login.jsx: tombol "Cari Server Otomatis" (testid server-scan-btn) + "Atur Server Manual (LAN)". Verified: health 200, button render, compiled successfully. Catatan: butuh CORS_ORIGINS=* di server LAN (sudah default di .env.docker) agar probe lintas-origin dari APK bisa baca JSON.

## PINTASAN KLIEN (2026-06-21)
- /Buka-POS-Windows.url (InternetShortcut → http://pos.local) & /Buka-POS-Linux.desktop (xdg-open http://pos.local). Ikut otomatis di project-zip (verified). Dobel-klik di komputer klien = buka aplikasi tanpa ketik alamat; edit ganti pos.local→IP bila perlu. Panduan di MULAI-DISINI.txt.

## BACKUP/RESTORE IN-APP + RESTART (2026-06-21)
- Backend: GET /api/backup/export (admin) → zip semua koleksi via bson.json_util.dumps (round-trip _id string/ObjectId aman). POST /api/backup/import (admin, UploadFile) → per file .json: delete_many + insert_many (json_util.loads). Verified round-trip 14 koleksi, produk tetap 3.
- Restart: /restart-windows.bat & /restart-pi.sh (docker compose restart) + embedded di installers.js.
- Frontend SettingsInstaller: bagian 3 Backup "Cara cepat (dalam aplikasi)" tombol inapp-backup (unduh) & inapp-restore (upload .zip, konfirmasi window.confirm, reload) + skrip server; bagian 4 Restart Server (download-restart-windows/-pi). Verified UI + compiled.
- CATATAN penting untuk user: INSTALL pertama/UPDATE/RESTART TIDAK bisa jadi tombol in-app (butuh kontrol Docker host / app harus sudah ada) → tetap via skrip. BACKUP/RESTORE bisa in-app (backend akses Mongo langsung).

## BACKUP OTOMATIS RASPBERRY PI (2026-06-21)
- /setup-autobackup-pi.sh: pasang cron harian 23:00 → ./backup-pi.sh, log ke backups/autobackup.log, idempoten (hapus baris lama dulu). Embedded SETUP_AUTOBACKUP_PI_SH di installers.js. Kartu unduh "Backup Otomatis Harian (Raspberry Pi)" (testid download-autobackup-pi) di bagian 3 Backup. Verified bash -n root+embedded.

## BOOTSTRAP PI (2026-06-21)
- /bootstrap-pi.sh: pasang Docker (get.docker.com) bila belum ada + usermod + sudo ./install-pi.sh. Embedded BOOTSTRAP_PI_SH; kartu "Pi baru (belum ada Docker)? Pakai Bootstrap" (testid download-bootstrap-pi) di bagian 1 Install. Verified bash -n + compiled.
- KEPUTUSAN: tombol web→SSH install Docker DITOLAK (chicken-egg: app jalan di Docker; + risiko simpan kredensial SSH). Ganti: bootstrap-pi.sh dijalankan sekali via SSH.
- OS Pi rekomendasi: Raspberry Pi OS Lite 64-bit (Bookworm), headless.

## KNOWN ISSUE (user action)
- 2026-06-21: AndroidManifest orientation diubah landscape→fullSensor (dukung portrait+landscape sesuai permintaan). README-ANDROID diupdate: alamat server runtime (bukan bake Emergent), orientasi bebas. Panduan instalasi: README-DEPLOY.md (server Docker) + README-ANDROID.md (APK).
- API Key provider AI (chenzk.top/v1) invalid (HTTP 401). Owner harus isi key valid per fungsi di Pengaturan AI agar fitur AI + cek kredit aktif.

## Deployment
- Deployed to production: https://hybrid-pos-aceh.emergent.host (health check PASS).
- Build 8 health check: teknis LULUS (kompilasi/env/CORS/crons valid). Satu-satunya flag = fitur Reset Data (disengaja, proteksi admin+password+ketik RESET) — user memilih tetap dipertahankan.
- Index DB ditambahkan di startup: orders {order_type,status} & {created_at desc}; products {type,active} & {category_id}. Verified created + queries 200.

## Backlog (prioritas)
- P1: Rate limiting / lockout login (±5 gagal).
- P1: CORS ketat (dari `*` ke domain produksi) sebelum go-live.
- P2: Docker-compose Raspberry Pi (server lokal) + sync agent lokal.
- P2: Log riwayat sync lintas perangkat (audit admin).
- P2: Ekspor laporan Excel harian/mingguan.
- Future: auto cetak tiket dapur saat open bill dine-in; grafik laporan lanjutan; refactor server.py/POS.jsx (kompleksitas).

## Accounts (seed) — see /app/memory/test_credentials.md
- admin: taqim2609@gmail.com / GrandAceh#2026
- kasir: kasir@grandaceh.com / kasir123
- input (Staf Input): input@grandaceh.com / input123

## ROLES & FITUR (2026-06-21)
- RBAC 3 peran: admin (full), kasir (POS/Kas/Shift, landing /pos), input/Staf Input (Produk+Kategori+Persediaan+AI desc/image/parse-invoice+import/export produk; landing /products; DENIED users/settings/reports/POS/reset → 403). Backend `admin_or_input=require_roles("admin","input")` di endpoints data-input. ProtectedRoute pakai `roles` array + `homeFor(role)`. Verified curl 200/200/403/403/403.
- Scan Faktur: opsi KAMERA perangkat (getUserMedia facingMode environment → canvas → dataURL). Tombol "Buka Kamera" + view live + "Ambil Foto"/"Tutup". testid: invoice-camera-btn, invoice-camera-video, invoice-capture-btn, invoice-cam-close-btn. (capture tak bisa e2e di headless; UI+logika terpasang, jalan di perangkat asli.)
- PORTRAIT: rotate-guard (blok "Putar Perangkat") DIHAPUS. Layout sidebar jadi drawer off-canvas di <1024px (hamburger sidebar-toggle + backdrop + close), statis di lg. main pt-14 lg:pt-0.

## FIX (2026-06-21) — Unduh Folder Proyek/Backup macet di "Menyiapkan..."
- Root cause: service worker (`frontend/public/sw.js`) meng-intercept & `clone()`+cache respons `/api` pada setup SATU-ORIGIN (nginx proxy /api = origin sama, juga di preview). Body zip besar (2,7 MB) dibuffer 2x → unduhan macet, progres tak jalan.
- Fix: sw.js bump CACHE v1→v2, bypass semua `/api/` (network-only, no cache), hapus cache lama saat activate. Disalin ke android assets/public/sw.js.
- UX: `SettingsInstaller.jsx` tambah indikator progres MB/% (onDownloadProgress) di tombol Unduh Folder Proyek & Backup Sekarang.
- Backend: `installers/project-zip` compresslevel=1 (lebih ringan di CPU Pi). Server kirim zip 2,7MB ~0,47s (curl). Verified via screenshot: unduhan lanjut ke "Mengunduh..." (tidak macet).
- Catatan: prasyarat Installer sudah menampilkan `sudo systemctl enable docker` untuk auto-start di Pi.
