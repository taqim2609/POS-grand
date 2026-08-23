# 📋 Grand Aceh Kuliner POS — Rangkuman Fitur Lengkap

> Catatan ini adalah ringkasan menyeluruh semua fitur POS untuk membantu AI/developer berikutnya melanjutkan pengembangan.
> Stack: **FastAPI + MongoDB (Motor)** backend, **React (CRA) + Tailwind** frontend, **Capacitor + Capgo OTA** untuk Android, di-host di **Raspberry Pi (Docker Compose + Nginx)**.
> Bahasa utama aplikasi & komunikasi: **Bahasa Indonesia**.

---

## 1. Arsitektur & Deployment
- **Hybrid lokal + cloud**: berjalan di Raspberry Pi via `docker-compose.yml` (backend, frontend/nginx, MongoDB `mongo:4.4.18` — versi khusus kompatibel Pi 3).
- **Offline-first PWA**: `OfflineContext.jsx` mengelola antrian sinkronisasi via `localStorage`. **JANGAN di-refactor** — akan merusak kemampuan offline.
- **Sinkronisasi**: `GET /api/sync/master` (tarik master data), `POST /api/sync/push` (dorong order offline).
- **Android APK**: dibungkus Capacitor. Update React di-push ke GitHub → Pi jalankan `./update-pi.sh` → APK tarik update via **Capgo OTA** (`lib/ota.js`, `scripts/make-ota.js` menghasilkan `build/ota/bundle.zip` + `version.json`).
  - ⚠️ **Service Worker (`sw.js`) DINONAKTIFKAN** di wrapper native (konflik cache dengan OTA → layar putih).
  - `package.json` → `homepage: "."` (aset path relatif). `AndroidManifest.xml` → `usesCleartextTraffic` + izin kamera.
- **Build wajib setelah ubah frontend**: `REACT_APP_BACKEND_URL="" GENERATE_SOURCEMAP=false yarn build` (regenerasi OTA bundle), lalu **Save to Github**. `build/` DILACAK di git.
- **Skrip Pi**: `install-pi.sh`, `bootstrap-pi.sh`, `update-pi.sh`, `restart-pi.sh`, `backup-pi.sh`/`restore-pi.sh`, `setup-autobackup-pi.sh`, `setup-autoupdate-pi.sh` (cron), `setup-power-schedule-pi.sh` (jadwal nyala/mati), `setup-tailscale.sh` (akses remote LAN). mDNS: `grandpos.local`.
- **Panduan**: `PANDUAN-GITHUB.md`, `PANDUAN-TAILSCALE.md`, `README-DEPLOY.md`.

## 2. Autentikasi & Peran (RBAC)
- JWT bearer (disimpan di `localStorage` key `gak_token`). Password di-hash **bcrypt**.
- Endpoint: `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/change-password`, `POST /api/users/{uid}/reset-password` (admin).
- **3 peran**:
  - **admin**: akses penuh. Landing → `/dashboard`.
  - **kasir**: POS Kasir, Kas, Shift, Perangkat. Landing → `/pos`.
  - **input** (Staf Input): Produk & Stok (Produk, Kategori, Persediaan, Vendor), fitur AI, import/export. DILARANG (403): users, settings, laporan, POS/orders, reset-data. Landing → `/products`.
- Helper backend: `require_admin`, `admin_or_input = require_roles("admin","input")`.
- **Akun uji** ada di `/app/memory/test_credentials.md`.

## 3. POS / Penjualan (`POS.jsx`)
- Tipe order: **dine_in** (wajib pilih meja), **take_away**, **retail**.
- Produk F&B (makanan/minuman/**vendor**) untuk dine-in & take-away; produk **retail** hanya untuk order retail (tidak boleh dicampur — divalidasi `_validate_order_rules`).
- Diskon, multi payment method, bayar langsung (`pay_now`) atau simpan order lalu bayar.
- Barcode scanner (izin kamera Android sudah diaktifkan) untuk produk retail.
- Endpoint: `POST /api/orders`, `GET /api/orders`, `GET /api/orders/{oid}`, `POST /api/orders/{oid}/pay`, `POST /api/orders/{oid}/void` (admin).
- Cetak struk: dukungan printer **Sunmi** (built-in) & **Epson** (`DeviceSettings.jsx`). `browserslist` disesuaikan agar jalan di WebView lama Sunmi.

## 4. Produk, Kategori, Vendor, Persediaan (menu "Produk & Stok" / `Catalog.jsx` — tab)
- **Produk** (`Products.jsx`): CRUD, 4 tipe → `makanan`, `minuman`, `retail`, **`vendor`**.
  - Tipe `retail`: pakai `stock`, `min_stock`, `track_stock=true`, `cost` (Harga Beli).
  - Tipe `makanan`/`minuman`: `cost` = HPP.
  - Tipe **`vendor`** (bagi hasil/konsinyasi): tanpa HPP; pakai `vendor_id` + `vendor_share_percent` (% dari OMZET/harga jual). Dijual di alur F&B.
- **Kategori** (`Categories.jsx`): CRUD, `type` ∈ makanan/minuman/retail/**vendor** + `sort_order`.
- **Vendor** (`Vendors.jsx`): CRUD pemilik produk titipan {name, contact, note, active}. Hapus vendor yang dipakai produk → soft-deactivate.
- **Persediaan** (`Inventory.jsx`): pembelian stok (`POST /api/purchases`, `/purchases/bulk`), stok opname (`POST /api/stock-opname`), parse invoice via AI (`POST /api/ai/parse-invoice`).
- **Import/Export produk**: template (`GET /api/products/template`), export (`GET /api/products/export`), import preview/commit (`POST /api/products/import/preview|commit`), log (`GET /api/import-logs`).

## 5. Kas & Shift
- **Kas** (`Cash.jsx`): kas masuk/keluar (`POST /api/cash`, `GET /api/cash`).
- **Shift** (`Shift.jsx`): buka/tutup shift dengan modal awal & hitung akhir (`/api/shifts/current|open|close`, `GET /api/shifts`).

## 6. Laporan (menu "Laporan" / `Reports.jsx`, admin) ⭐ terbaru
- Pemilih periode: **Harian** (tanggal), **Mingguan** (Sen–Min dari tanggal), **Bulanan** (input bulan).
- KPI: Total Penjualan, Jumlah Order, Laba Kotor, Bagi Hasil Vendor.
- **Grafik Tren Penjualan Harian** (recharts LineChart) untuk periode mingguan/bulanan (sumber `/api/reports/range`).
- Rincian penjualan per kategori: **Makanan, Minuman, Retail** (beserta kategori & qty).
- **Tabel Bagi Hasil Vendor** (omzet, bagi hasil vendor, bagian outlet) + total.
- **Ekspor**: Excel/PDF seluruh laporan periode (`/api/reports/period/export/excel|pdf`) & Excel/PDF/Kirim WA khusus vendor (`/api/reports/vendors/...`).
- Endpoint inti: `GET /api/reports/period?start=&end=`, `GET /api/reports/summary?date=` (dipakai Dashboard, kini termasuk `vendor_summary`), `GET /api/reports/range`, `GET /api/reports/vendors`.

## 7. Dashboard (`Dashboard.jsx`, admin)
- KPI harian: total penjualan, order, laba kotor, rata-rata, **kartu Bagi Hasil Vendor hari ini** (teal), kas bersih.
- Ringkasan per tipe order & metode pembayaran, produk terlaris, laporan kategori harian.

## 8. Transaksi (`Orders.jsx`, admin)
- Riwayat order, detail, void order, audit log (`GET /api/audit-logs`).

## 9. Integrasi AI (`SettingsAI.jsx`, `ReportChat.jsx`)
- Provider: OpenAI GPT / Gemini / provider custom (kompatibel OpenAI). Pakai **Emergent LLM Key** (fallback) atau API key pengguna.
- Fitur AI: parse invoice pembelian, generate deskripsi produk (`/api/ai/product-description`), generate gambar produk (`/api/ai/product-image`), ringkasan laporan (`/api/reports/ai-summary`).
- **Tanya AI** (menu, `ReportChat.jsx`): chat laporan berbasis sesi (`/api/ai/report-chat`, `GET /api/ai/report-chat/{session_id}`, kirim hasil ke WA `/api/ai/report-chat/send-wa`). Pemilih model + cek kredit (`/api/settings/ai/models`, `/api/settings/ai/credit`).

## 10. WhatsApp (`WhatsApp.jsx`, `WhatsAppReport.jsx` — tab "WhatsApp & Laporan")
- Integrasi via **`wacloud.id`** (HTTP API ringan — mengganti `whatsapp-web.js` yang berat untuk Pi 3). **Butuh API key pengguna.**
- Config (`/api/whatsapp/config`, `/api/whatsapp/devices`, `/api/whatsapp/test`).
- Laporan harian otomatis via WA (`/api/reports/send-whatsapp`, setting penerima `/api/settings/report`).
- Cron: `POST /api/cron/daily-report` (laporan harian), `POST /api/cron/notify` (notifikasi update dari skrip Pi).

## 11. Pengaturan (menu "Pengaturan" / `Settings.jsx`, admin — tab)
- **Pengguna** (`Users.jsx`), **Meja** (`Tables.jsx`), **Perangkat** (`DeviceSettings.jsx` — printer Sunmi/Epson), **Pengaturan AI**, **WhatsApp & Laporan**, **Installer** (`SettingsInstaller.jsx` — unduh project zip / update via Docker `GET/POST /api/admin/update`), **Reset Data** (`SettingsData.jsx`, `POST /api/admin/reset-data`).
- Backup/restore: `GET /api/backup/export`, `POST /api/backup/import`.

---

## 🗄️ Skema Data Utama (MongoDB)
- `users`: {id, name, email, password_hash, role(admin|kasir|input), active}
- `categories`: {id, name, type(makanan|minuman|retail|vendor), sort_order}
- `products`: {id, name, sku, category_id, type, price, cost, stock, min_stock, track_stock, image, active, sold_out, **vendor_id**, **vendor_share_percent**}
- `vendors`: {id, name, contact, note, active, created_at}
- `orders`: {id, order_type, table, items[], subtotal, discount, total, status(open|paid|void), payment_method, payment_method_name, created_at, ...}
  - `items[]`: {product_id, name, price, cost, qty, type, track_stock, **vendor_id**, **vendor_share_percent**, **vendor_total**}
- `tables`, `payment_methods`, `shifts`, `cash_moves`, `purchases`, `stock_opname`, `audit_logs`, `import_logs`, `settings` (`_id`: "ai" | "report" | "whatsapp").

## 🔌 Endpoint Penting (prefix `/api`)
Lihat daftar lengkap di `backend/server.py`. Kelompok: auth, users, categories, products, vendors, tables, payment-methods, orders, shifts, cash, reports (summary/range/period + export excel/pdf + vendors), purchases, stock-opname, sync, ai, whatsapp, settings, admin (update/reset/backup), cron.

## ⚠️ Aturan Penting untuk AI Berikutnya
1. **JANGAN refactor `OfflineContext.jsx`** (merusak offline sync).
2. **JANGAN aktifkan service worker** (`sw.js`) — konflik dengan Capgo OTA.
3. Setelah ubah frontend: `yarn build` (regen OTA), lalu arahkan user "Save to Github" → jalankan `./update-pi.sh` di Pi. **Jangan rebuild APK** kecuali ubah kode native.
4. Semua config via `.env` (jangan hardcode). Backend pakai `MONGO_URL`, `DB_NAME`; frontend pakai `REACT_APP_BACKEND_URL`.
5. Datetime pakai `datetime.now(timezone.utc)`. Zona waktu laporan = WIB (helper `wib_today`, `wib_day_range`).
6. Semua route backend prefix `/api`.

## 🚧 Backlog / Fitur Mendatang
- **P1** Anti brute-force: penguncian login kasir setelah beberapa kali gagal.
- **P1** Alarm stok menipis: notifikasi WhatsApp otomatis via `wacloud.id`.
- **P2** Cetak label barcode/SKU produk retail langsung dari aplikasi.
- **P2** Kirim WA seluruh laporan periode (bukan hanya vendor).
- **P3** Filter rentang tanggal pada chat "Tanya AI".

_Terakhir diperbarui: Juni 2026 — setelah fitur Vendor (bagi hasil), Tab Laporan (harian/mingguan/bulanan), grafik tren, & ekspor laporan periode._
