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

## Build 3 (2026-06) — Password management
- POST /api/auth/change-password (self, verify current, min 6).
- POST /api/users/{uid}/reset-password (admin-only, min 6).
- Frontend: "Ganti Password" (semua role, sidebar) + "Reset Password" per user (admin, Pengguna).
- Verified: testing agent iteration_7 frontend 100% (4/4, 6/6 validasi); backend curl (400/403 sesuai).

## Code review fixes (2026-06)
- receipt.js: document.write -> Blob URL (XSS hardening).
- eslint exhaustive-deps: justifikasi disable pada efek mount/filter (Products/Orders/Tables/Users/Shift/POS).
- .gitignore: hapus blok .env agar file env aman-deploy ikut ter-deploy.

## KNOWN ISSUE (user action)
- API Key provider AI (chenzk.top/v1) invalid (HTTP 401). Owner harus isi key valid per fungsi di Pengaturan AI agar fitur AI + cek kredit aktif.

## Deployment
- Deployed to production: https://hybrid-pos-aceh.emergent.host (health check PASS).

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
