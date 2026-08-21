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

## KNOWN ISSUE (user action)
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
