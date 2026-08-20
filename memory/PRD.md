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

## Offline resilience (cloud-hosted, added)
- Frontend is a PWA: service worker (`public/sw.js`, network-first + cache fallback) caches app shell so POS opens even after internet is cut / app restart; `manifest.json` + icons make it installable (landscape, standalone).
- Auth is offline-safe: on network error `/auth/me` keeps session from cached `gak_user` (only real 401 logs out) — kasir stays logged in offline.
- POS caches master data (`gak_pos_cache`) and queues take-away/retail sales offline (`gak_pending_orders`), stamps receipt "BELUM DISINKRON", auto-syncs on reconnect. Dine-in offline blocked.
- LIMITATION: true always-offline (even if device never loaded app online, or backend unreachable at boot) requires the local outlet server (Raspberry Pi/mini-PC) + local↔cloud sync layer — NOT yet built. AI stays on Emergent key for now.

## Backlog (P1/P2 — non-blocking)
- Timezone: DONE — reports/shift bucket by WIB (UTC+7).
- Login rate limiting/lockout. (P1 — still pending)
- Production config: strict CORS + move seed cashier creds to env. (P1 — pending)
- Raspberry Pi docker-compose + local sync agent. (P2 — pending)
- Sync history audit across devices. (P2 — pending)

## Build 2 (2026-06) — added
- AI provider migrated to custom OpenAI-compatible endpoint (base URL / model / API key). `_ai_cfg()` reads DB `settings._id=ai` override, falls back to `.env`.
- Pengaturan AI page (`/settings-ai`, admin-only): edit Base URL / Model / API Key with security warning; blank key preserves existing key. Endpoints `GET/PUT /api/settings/ai`.
- Per-product low-stock threshold: `ProductIn.min_stock` (default 10); Products form field for retail; Dashboard low-stock panel/banner use per-product threshold via aggregation ($ifNull fallback).
- Weekly/Monthly sales trend chart (Dashboard "Tren Penjualan", `/reports/range`).
- Profit margin per product in reports: `/reports/summary` top_products now returns cost/profit/margin; Dashboard "Produk Terlaris & Margin" table.
- Date param validation on `wib_day_range` → 400 instead of 500 for malformed dates.
- Dashboard: replaced duplicate "Total Penjualan" KPI with "Rata-rata per Order".

## KNOWN ISSUE (needs user action)
- AI provider key in `backend/.env` (`OPENAI_COMPAT_API_KEY`) returns HTTP 401 "Invalid token" at `https://www.chenzk.top/v1`. AI features (deskripsi/gambar/ringkasan) will fail until owner enters a VALID key in Pengaturan AI.

## Verified (build 2)
- Testing agent iteration_5: frontend 100% (all 4 features), backend 94% (16/17 new tests). Date-validation fix confirmed 400. AI 401 is a stale third-party key, not a code bug.

## Credentials
See `/app/memory/test_credentials.md`. Admin: taqim2609@gmail.com / GrandAceh#2026. Kasir: kasir@grandaceh.com / kasir123.
