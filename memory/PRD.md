# Grand Aceh Kuliner POS — PRD

## Original Problem Statement
POS hybrid F&B + retail untuk Grand Aceh Kuliner. POS komputer (non-dine-in: take away + retail), POS Android landscape (dine-in + non-dine-in), backend FastAPI + MongoDB. Logika F&B dan retail dipisah sejak awal. Fitur: master data (produk/kategori/meja/pembayaran), open bill dine-in, checkout+diskon+struk, import/export Excel, shift & laporan (dipisah dine-in/take-away/retail + gabungan), dashboard admin, AI (deskripsi produk, gambar produk, ringkasan laporan).

## User Choices (confirmed)
- AI: Gemini (teks `gemini-2.5-flash`, gambar Nano Banana `gemini-3.1-flash-image-preview`) via EMERGENT_LLM_KEY
- Pembayaran hari-1: Cash + QRIS + Kartu Debit/Kredit
- Meja V1: dasar + tambah order ke meja yang sama (open bill append). Tanpa pindah/gabung/split
- Split payment: ditunda
- Stok: hanya retail yang punya stok; F&B tanpa stok

## Architecture
- Backend: FastAPI (`/app/backend/server.py`), MongoDB (motor). JWT Bearer auth (localStorage `gak_token`).
- Frontend: React + shadcn/ui + Tailwind. Landscape-first POS. Pages: Login, POS, Shift, Dashboard, Products, Categories, Tables, Orders, Users.
- Server-authoritative orders: price/name/type/stock resolved from DB, not trusted from client.

## Personas
- Admin/Owner: kelola master data, laporan, AI, void/refund, pengguna.
- Kasir: POS + shift only (nav & routes role-gated).

## Implemented (2026-06 / build 1)
- Auth JWT admin+kasir, idempotent seeding, RBAC (require_admin).
- Categories CRUD (typed, soft-deactivate if used, sort order).
- Products CRUD (SKU unique, price>=0, sold-out toggle, retail stock, image), soft-delete if used.
- Tables CRUD per area (unique name, dine-in only, cannot deactivate/delete with open bill, soft-delete if used).
- Payment methods (Cash/QRIS/Kartu Debit-Kredit seeded).
- Orders: take-away/retail + dine-in open bill (append via PATCH), pay, receipt print. Hard rules: F&B vs retail separation enforced server-side; dine-in requires table; retail/take-away cannot use table.
- Payment: discount (percent/amount, bounded), cash change, underpayment rejected, oversell rejected.
- Void/Refund: admin-only, audit log, retail stock restore, paid orders immutable.
- Shift open/close + shift report (by type, expected cash by payment type).
- Reports: daily summary split dine_in/take_away/retail + combined (F&B vs retail), by payment method, top products; range endpoint.
- Excel: template download, export, import preview (per-row validation + error report), commit, import logs.
- AI (Gemini): product description, product image, sales report summary.
- Dashboard with charts (recharts) + AI summary panel.

## Verified
- 67/67 backend pytest happy-path pass; all frontend flows pass (testing agent iteration_1).
- 6 adversarial security gaps fixed & re-verified via curl (price tamper, type spoof, negative qty, negative discount, underpayment, oversell).
- E2E take-away purchase → payment → receipt confirmed via screenshot.

## Backlog (P1/P2 — non-blocking)
- Timezone: reports/shift bucket by UTC day; add WIB (UTC+7) offset for accurate Aceh day boundaries.
- Login rate limiting/lockout.
- POS portrait (<768px) layout guard / collapsible rails.
- Replace native date inputs with shadcn Calendar on Dashboard/Transaksi.
- Dialog aria-describedby a11y warnings.
- Real hardware: Sunmi T2s printer + cash drawer integration (currently browser print). NOT IMPLEMENTED (cannot test in cloud).
- Local+cloud hybrid sync / offline mode. NOT IMPLEMENTED (structural only; cloud env is single-node).

## Credentials
See `/app/memory/test_credentials.md`. Admin: taqim2609@gmail.com / GrandAceh#2026. Kasir: kasir@grandaceh.com / kasir123.
