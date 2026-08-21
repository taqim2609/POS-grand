from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, date, timedelta
import logging, uuid, io, bcrypt, jwt, asyncio

# ------------------------------------------------------------------ DB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
GEMINI_TEXT_MODEL = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
GEMINI_IMAGE_MODEL = os.environ.get('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash-image')
OPENAI_COMPAT_BASE_URL = os.environ.get('OPENAI_COMPAT_BASE_URL')
OPENAI_COMPAT_API_KEY = os.environ.get('OPENAI_COMPAT_API_KEY')
OPENAI_COMPAT_MODEL = os.environ.get('OPENAI_COMPAT_MODEL') or 'gpt-4o-mini'

app = FastAPI(title="Grand Aceh Kuliner POS")
api = APIRouter(prefix="/api")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gak-pos")

PRODUCT_TYPES = ["makanan", "minuman", "retail"]
ORDER_TYPES = ["dine_in", "take_away", "retail"]

def now_utc():
    return datetime.now(timezone.utc)

WIB = timezone(timedelta(hours=7))
LOW_STOCK_THRESHOLD = 10

def wib_today():
    return now_utc().astimezone(WIB).strftime("%Y-%m-%d")

def wib_day_range(date_str):
    """Given a WIB calendar date 'YYYY-MM-DD', return (start_utc_iso, end_utc_iso)."""
    try:
        start = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=WIB)
    except (ValueError, TypeError):
        raise HTTPException(400, f"Tanggal tidak valid: '{date_str}'. Gunakan format YYYY-MM-DD.")
    end = start + timedelta(days=1)
    return start.astimezone(timezone.utc).isoformat(), end.astimezone(timezone.utc).isoformat()

def wib_day_of(iso_str):
    return datetime.fromisoformat(iso_str).astimezone(WIB).strftime("%Y-%m-%d")

def new_id():
    return str(uuid.uuid4())

# ------------------------------------------------------------------ Security
def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False

def create_token(user: dict) -> str:
    payload = {"sub": user["id"], "role": user["role"], "email": user["email"],
               "exp": now_utc() + timedelta(hours=12), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else request.cookies.get("access_token")
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user or not user.get("active", True):
        raise HTTPException(401, "User not found or inactive")
    return user

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(403, "Admin access required")
    return user

# ------------------------------------------------------------------ Models
class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Literal["admin", "kasir"] = "kasir"

class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str

class ResetPasswordIn(BaseModel):
    new_password: str

class ResetDataIn(BaseModel):
    scope: Literal["transactions", "all"]
    password: str

class CategoryIn(BaseModel):
    name: str
    type: Literal["makanan", "minuman", "retail"]
    sort_order: int = 0
    active: bool = True

class ProductIn(BaseModel):
    name: str
    sku: str
    category_id: str
    type: Literal["makanan", "minuman", "retail"]
    price: float
    cost: float = 0
    description: Optional[str] = ""
    image: Optional[str] = ""
    active: bool = True
    sold_out: bool = False
    stock: Optional[int] = 0
    min_stock: Optional[int] = 10

class TableIn(BaseModel):
    name: str
    area: str = "Umum"
    capacity: int = 4
    active: bool = True

class PaymentMethodIn(BaseModel):
    name: str
    type: Literal["cash", "qris", "card"]
    active: bool = True

class OrderItem(BaseModel):
    product_id: str
    name: Optional[str] = ""
    price: Optional[float] = 0
    qty: int = Field(gt=0)
    type: Optional[str] = ""

class OrderIn(BaseModel):
    order_type: Literal["dine_in", "take_away", "retail"]
    table_id: Optional[str] = None
    items: List[OrderItem]
    discount_type: Literal["none", "percent", "amount"] = "none"
    discount_value: float = Field(0, ge=0)
    note: Optional[str] = ""
    pay_now: bool = False
    payment_method: Optional[str] = None
    client_ref: Optional[str] = None

class ItemsUpdate(BaseModel):
    items: List[OrderItem]

class PayIn(BaseModel):
    payment_method: str
    discount_type: Literal["none", "percent", "amount"] = "none"
    discount_value: float = Field(0, ge=0)
    amount_paid: Optional[float] = None

class VoidIn(BaseModel):
    reason: str
    action: Literal["void", "refund"] = "void"

class ShiftOpenIn(BaseModel):
    opening_cash: float = 0

class ShiftCloseIn(BaseModel):
    closing_cash: float = 0

class AIDescIn(BaseModel):
    name: str
    type: str
    category: Optional[str] = ""
    keywords: Optional[str] = ""

class AIImageIn(BaseModel):
    name: str
    description: Optional[str] = ""

class AISummaryIn(BaseModel):
    date: Optional[str] = None

# ------------------------------------------------------------------ helpers
def compute_totals(items, discount_type, discount_value):
    subtotal = sum(i["price"] * i["qty"] for i in items)
    discount_value = max(0, discount_value)
    if discount_type == "percent":
        discount = round(subtotal * (min(discount_value, 100) / 100.0), 2)
    elif discount_type == "amount":
        discount = min(discount_value, subtotal)
    else:
        discount = 0
    total = max(0, round(subtotal - discount, 2))
    return round(subtotal, 2), round(discount, 2), total

async def gen_order_number():
    today = wib_today().replace("-", "")
    cid = f"order-{today}"
    # migration-safe init: seed counter from any orders already created today
    if not await db.counters.find_one({"_id": cid}):
        cnt = await db.orders.count_documents({"order_number": {"$regex": f"^GAK-{today}-"}})
        await db.counters.update_one({"_id": cid}, {"$setOnInsert": {"seq": cnt}}, upsert=True)
    doc = await db.counters.find_one_and_update(
        {"_id": cid}, {"$inc": {"seq": 1}}, return_document=ReturnDocument.AFTER
    )
    return f"GAK-{today}-{doc['seq']:04d}"

# ================================================================== AUTH
@api.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Email atau password salah")
    if not user.get("active", True):
        raise HTTPException(403, "Akun dinonaktifkan")
    safe = {"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]}
    return {"token": create_token(safe), "user": safe}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@api.get("/users")
async def list_users(admin: dict = Depends(require_admin)):
    return await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", 1).to_list(500)

@api.post("/users")
async def create_user(body: UserCreate, admin: dict = Depends(require_admin)):
    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(400, "Email sudah dipakai")
    doc = {"id": new_id(), "name": body.name, "email": body.email.lower(),
           "password_hash": hash_password(body.password), "role": body.role,
           "active": True, "created_at": now_utc().isoformat()}
    await db.users.insert_one(doc)
    return {"id": doc["id"], "name": doc["name"], "email": doc["email"], "role": doc["role"]}

@api.patch("/users/{uid}/toggle")
async def toggle_user(uid: str, admin: dict = Depends(require_admin)):
    u = await db.users.find_one({"id": uid})
    if not u:
        raise HTTPException(404, "User tidak ditemukan")
    await db.users.update_one({"id": uid}, {"$set": {"active": not u.get("active", True)}})
    return {"active": not u.get("active", True)}

@api.post("/auth/change-password")
async def change_password(body: ChangePasswordIn, user: dict = Depends(get_current_user)):
    if len(body.new_password) < 6:
        raise HTTPException(400, "Password baru minimal 6 karakter")
    full = await db.users.find_one({"id": user["id"]})
    if not full or not verify_password(body.current_password, full["password_hash"]):
        raise HTTPException(400, "Password lama salah")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"ok": True}

@api.post("/users/{uid}/reset-password")
async def reset_user_password(uid: str, body: ResetPasswordIn, admin: dict = Depends(require_admin)):
    if len(body.new_password) < 6:
        raise HTTPException(400, "Password minimal 6 karakter")
    u = await db.users.find_one({"id": uid})
    if not u:
        raise HTTPException(404, "User tidak ditemukan")
    await db.users.update_one({"id": uid}, {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"ok": True}

@api.post("/admin/reset-data")
async def reset_data(body: ResetDataIn, admin: dict = Depends(require_admin)):
    """Destructive: wipe transactional (and optionally catalog) data. Keeps users, settings, payment methods."""
    full = await db.users.find_one({"id": admin["id"]})
    if not full or not verify_password(body.password, full["password_hash"]):
        raise HTTPException(400, "Password admin salah")
    tx = ["orders", "cash_movements", "shifts", "stock_opname", "purchases", "counters", "import_logs", "audit_logs"]
    catalog = ["products", "categories", "tables"]
    cols = tx + (catalog if body.scope == "all" else [])
    deleted = {}
    for col in cols:
        r = await db[col].delete_many({})
        deleted[col] = r.deleted_count
    return {"ok": True, "scope": body.scope, "deleted": deleted}

# ================================================================== CATEGORIES
@api.get("/categories")
async def list_categories(include_inactive: bool = True, user: dict = Depends(get_current_user)):
    q = {} if include_inactive else {"active": True}
    return await db.categories.find(q, {"_id": 0}).sort("sort_order", 1).to_list(500)

@api.post("/categories")
async def create_category(body: CategoryIn, admin: dict = Depends(require_admin)):
    doc = body.model_dump()
    doc.update({"id": new_id(), "created_at": now_utc().isoformat()})
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/categories/{cid}")
async def update_category(cid: str, body: CategoryIn, admin: dict = Depends(require_admin)):
    if not await db.categories.find_one({"id": cid}):
        raise HTTPException(404, "Kategori tidak ditemukan")
    await db.categories.update_one({"id": cid}, {"$set": body.model_dump()})
    return await db.categories.find_one({"id": cid}, {"_id": 0})

@api.delete("/categories/{cid}")
async def delete_category(cid: str, admin: dict = Depends(require_admin)):
    used = await db.products.count_documents({"category_id": cid})
    if used:
        # soft deactivate instead of hard delete
        await db.categories.update_one({"id": cid}, {"$set": {"active": False}})
        return {"soft_deleted": True, "reason": f"Kategori dipakai {used} produk, dinonaktifkan (tidak dihapus)."}
    await db.categories.delete_one({"id": cid})
    return {"deleted": True}

# ================================================================== PRODUCTS
@api.get("/products")
async def list_products(type: Optional[str] = None, category_id: Optional[str] = None,
                        active_only: bool = False, user: dict = Depends(get_current_user)):
    q = {}
    if type:
        q["type"] = type
    if category_id:
        q["category_id"] = category_id
    if active_only:
        q["active"] = True
    return await db.products.find(q, {"_id": 0}).sort("name", 1).to_list(2000)

@api.post("/products")
async def create_product(body: ProductIn, admin: dict = Depends(require_admin)):
    if body.price < 0 or body.cost < 0:
        raise HTTPException(400, "Harga/HPP tidak boleh negatif")
    if await db.products.find_one({"sku": body.sku}):
        raise HTTPException(400, f"SKU '{body.sku}' sudah dipakai")
    if not await db.categories.find_one({"id": body.category_id}):
        raise HTTPException(400, "Kategori tidak valid")
    doc = body.model_dump()
    doc["track_stock"] = body.type == "retail"
    doc.update({"id": new_id(), "created_at": now_utc().isoformat()})
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/products/{pid}")
async def update_product(pid: str, body: ProductIn, admin: dict = Depends(require_admin)):
    if body.price < 0 or body.cost < 0:
        raise HTTPException(400, "Harga/HPP tidak boleh negatif")
    existing = await db.products.find_one({"id": pid})
    if not existing:
        raise HTTPException(404, "Produk tidak ditemukan")
    dup = await db.products.find_one({"sku": body.sku, "id": {"$ne": pid}})
    if dup:
        raise HTTPException(400, f"SKU '{body.sku}' sudah dipakai produk lain")
    doc = body.model_dump(exclude_unset=True)
    if "type" in doc:
        doc["track_stock"] = doc["type"] == "retail"
    await db.products.update_one({"id": pid}, {"$set": doc})
    return await db.products.find_one({"id": pid}, {"_id": 0})

@api.patch("/products/{pid}/sold-out")
async def toggle_sold_out(pid: str, user: dict = Depends(get_current_user)):
    p = await db.products.find_one({"id": pid})
    if not p:
        raise HTTPException(404, "Produk tidak ditemukan")
    val = not p.get("sold_out", False)
    await db.products.update_one({"id": pid}, {"$set": {"sold_out": val}})
    return {"sold_out": val}

@api.delete("/products/{pid}")
async def delete_product(pid: str, admin: dict = Depends(require_admin)):
    used = await db.orders.count_documents({"items.product_id": pid})
    if used:
        await db.products.update_one({"id": pid}, {"$set": {"active": False}})
        return {"soft_deleted": True, "reason": "Produk pernah dipakai transaksi, dinonaktifkan."}
    await db.products.delete_one({"id": pid})
    return {"deleted": True}

# ================================================================== TABLES
@api.get("/tables")
async def list_tables(user: dict = Depends(get_current_user)):
    tables = await db.tables.find({"deleted": {"$ne": True}}, {"_id": 0}).sort("area", 1).to_list(500)
    open_orders = await db.orders.find({"order_type": "dine_in", "status": "open"}, {"_id": 0, "table_id": 1, "id": 1, "total": 1}).to_list(1000)
    open_map = {}
    for o in open_orders:
        open_map[o["table_id"]] = o
    for t in tables:
        oo = open_map.get(t["id"])
        t["status"] = "open_bill" if oo else "empty"
        t["open_order_id"] = oo["id"] if oo else None
    return tables

@api.post("/tables")
async def create_table(body: TableIn, admin: dict = Depends(require_admin)):
    if await db.tables.find_one({"name": body.name, "deleted": {"$ne": True}}):
        raise HTTPException(400, f"Nama/kode meja '{body.name}' sudah ada")
    doc = body.model_dump()
    doc.update({"id": new_id(), "deleted": False, "created_at": now_utc().isoformat()})
    await db.tables.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/tables/{tid}")
async def update_table(tid: str, body: TableIn, admin: dict = Depends(require_admin)):
    t = await db.tables.find_one({"id": tid})
    if not t:
        raise HTTPException(404, "Meja tidak ditemukan")
    dup = await db.tables.find_one({"name": body.name, "id": {"$ne": tid}, "deleted": {"$ne": True}})
    if dup:
        raise HTTPException(400, f"Nama/kode meja '{body.name}' sudah ada")
    if t.get("active") and not body.active:
        open_bill = await db.orders.find_one({"table_id": tid, "status": "open"})
        if open_bill:
            raise HTTPException(400, "Meja punya open bill aktif, tidak bisa dinonaktifkan")
    await db.tables.update_one({"id": tid}, {"$set": body.model_dump()})
    return await db.tables.find_one({"id": tid}, {"_id": 0})

@api.delete("/tables/{tid}")
async def delete_table(tid: str, admin: dict = Depends(require_admin)):
    open_bill = await db.orders.find_one({"table_id": tid, "status": "open"})
    if open_bill:
        raise HTTPException(400, "Meja punya open bill aktif, tidak bisa dihapus")
    used = await db.orders.count_documents({"table_id": tid})
    if used:
        await db.tables.update_one({"id": tid}, {"$set": {"active": False}})
        return {"soft_deleted": True, "reason": "Meja pernah dipakai transaksi, dinonaktifkan (tidak dihapus)."}
    await db.tables.update_one({"id": tid}, {"$set": {"deleted": True, "active": False}})
    return {"deleted": True}

# ================================================================== PAYMENT METHODS
@api.get("/payment-methods")
async def list_payment_methods(user: dict = Depends(get_current_user)):
    return await db.payment_methods.find({}, {"_id": 0}).sort("name", 1).to_list(100)

@api.post("/payment-methods")
async def create_pm(body: PaymentMethodIn, admin: dict = Depends(require_admin)):
    doc = body.model_dump()
    doc.update({"id": new_id()})
    await db.payment_methods.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.patch("/payment-methods/{pmid}/toggle")
async def toggle_pm(pmid: str, admin: dict = Depends(require_admin)):
    pm = await db.payment_methods.find_one({"id": pmid})
    if not pm:
        raise HTTPException(404, "Metode tidak ditemukan")
    await db.payment_methods.update_one({"id": pmid}, {"$set": {"active": not pm.get("active", True)}})
    return {"active": not pm.get("active", True)}

# ================================================================== ORDERS
async def _resolve_items(raw_items):
    """Rebuild every line item from the products collection (server-authoritative)."""
    resolved = []
    for it in raw_items:
        p = await db.products.find_one({"id": it.product_id}, {"_id": 0})
        if not p:
            raise HTTPException(400, f"Produk tidak ditemukan: {it.product_id}")
        if not p.get("active", True):
            raise HTTPException(400, f"Produk nonaktif tidak bisa dijual: {p['name']}")
        if p.get("sold_out"):
            raise HTTPException(400, f"Produk sold out: {p['name']}")
        resolved.append({"product_id": p["id"], "name": p["name"], "price": p["price"],
                         "cost": p.get("cost", 0),
                         "qty": it.qty, "type": p["type"], "track_stock": p.get("track_stock", False)})
    return resolved

async def _validate_order_rules(order_type, table_id, items):
    types = {i["type"] for i in items}
    if order_type == "retail":
        if any(t != "retail" for t in types):
            raise HTTPException(400, "Alur retail hanya boleh berisi item retail")
    else:  # dine_in / take_away
        if "retail" in types:
            raise HTTPException(400, "Item retail tidak boleh masuk alur F&B (dine-in/take away)")
    if order_type == "dine_in":
        if not table_id:
            raise HTTPException(400, "Dine-in wajib memilih meja")
        t = await db.tables.find_one({"id": table_id, "deleted": {"$ne": True}})
        if not t or not t.get("active", True):
            raise HTTPException(400, "Meja tidak valid atau nonaktif")
    elif table_id:
        raise HTTPException(400, "Take away/retail tidak boleh memakai meja")

async def _current_shift(user):
    return await db.shifts.find_one({"cashier_id": user["id"], "status": "open"}, {"_id": 0})

async def _finalize_payment(order, payment_method, amount_paid, user):
    pm = await db.payment_methods.find_one({"id": payment_method, "active": True})
    if not pm:
        raise HTTPException(400, "Metode pembayaran tidak valid/aktif")
    paid = amount_paid if amount_paid is not None else order["total"]
    if pm["type"] == "cash" and paid < order["total"]:
        raise HTTPException(400, "Jumlah bayar kurang dari total")
    shift = await _current_shift(user)
    # validate & decrement retail stock atomically
    for it in order["items"]:
        if it.get("type") == "retail":
            p = await db.products.find_one({"id": it["product_id"]}, {"_id": 0})
            if p and p.get("track_stock") and p.get("stock", 0) < it["qty"]:
                raise HTTPException(400, f"Stok '{it['name']}' tidak cukup (sisa {p.get('stock', 0)})")
    for it in order["items"]:
        if it.get("type") == "retail":
            await db.products.update_one({"id": it["product_id"], "track_stock": True},
                                         {"$inc": {"stock": -it["qty"]}})
    upd = {"status": "paid", "payment_method_id": payment_method, "payment_method_name": pm["name"],
           "payment_method_type": pm["type"], "amount_paid": paid,
           "change": round(paid - order["total"], 2),
           "paid_at": now_utc().isoformat(), "shift_id": shift["id"] if shift else None}
    await db.orders.update_one({"id": order["id"]}, {"$set": upd})
    return {**order, **upd}

@api.post("/orders")
async def create_order(body: OrderIn, user: dict = Depends(get_current_user)):
    if not body.items:
        raise HTTPException(400, "Keranjang kosong")
    if body.client_ref:
        dup = await db.orders.find_one({"client_ref": body.client_ref}, {"_id": 0})
        if dup:
            return dup  # idempotent: offline sync retry won't duplicate
    items = await _resolve_items(body.items)
    await _validate_order_rules(body.order_type, body.table_id, items)
    subtotal, discount, total = compute_totals(items, body.discount_type, body.discount_value)
    doc = {
        "id": new_id(), "order_number": await gen_order_number(),
        "order_type": body.order_type, "table_id": body.table_id, "items": items,
        "subtotal": subtotal, "discount_type": body.discount_type, "discount_value": body.discount_value,
        "discount": discount, "total": total, "note": body.note,
        "status": "open", "cashier_id": user["id"], "cashier_name": user["name"],
        "client_ref": body.client_ref,
        "created_at": now_utc().isoformat(),
    }
    await db.orders.insert_one(doc)
    doc.pop("_id", None)
    if body.pay_now:
        if not body.payment_method:
            raise HTTPException(400, "Pilih metode pembayaran")
        doc = await _finalize_payment(doc, body.payment_method, total, user)
    return doc

@api.get("/orders")
async def list_orders(status: Optional[str] = None, order_type: Optional[str] = None,
                      date_str: Optional[str] = Query(None, alias="date"),
                      user: dict = Depends(get_current_user)):
    q = {}
    if status:
        q["status"] = status
    if order_type:
        q["order_type"] = order_type
    if date_str:
        start, end = wib_day_range(date_str)
        q["created_at"] = {"$gte": start, "$lt": end}
    return await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)

@api.get("/orders/{oid}")
async def get_order(oid: str, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order tidak ditemukan")
    return o

@api.patch("/orders/{oid}/items")
async def update_order_items(oid: str, body: ItemsUpdate, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": oid})
    if not o:
        raise HTTPException(404, "Order tidak ditemukan")
    if o["status"] != "open":
        raise HTTPException(400, "Hanya open bill yang bisa ditambah item")
    items = await _resolve_items(body.items)
    await _validate_order_rules(o["order_type"], o.get("table_id"), items)
    subtotal, discount, total = compute_totals(items, o["discount_type"], o["discount_value"])
    await db.orders.update_one({"id": oid}, {"$set": {"items": items, "subtotal": subtotal,
                                                       "discount": discount, "total": total}})
    return await db.orders.find_one({"id": oid}, {"_id": 0})

@api.post("/orders/{oid}/pay")
async def pay_order(oid: str, body: PayIn, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order tidak ditemukan")
    if o["status"] != "open":
        raise HTTPException(400, "Order sudah lunas / tidak bisa dibayar")
    subtotal, discount, total = compute_totals(o["items"], body.discount_type, body.discount_value)
    await db.orders.update_one({"id": oid}, {"$set": {"discount_type": body.discount_type,
                                                      "discount_value": body.discount_value,
                                                      "discount": discount, "total": total, "subtotal": subtotal}})
    o.update({"discount": discount, "total": total, "subtotal": subtotal})
    return await _finalize_payment(o, body.payment_method, body.amount_paid, user)

@api.post("/orders/{oid}/void")
async def void_order(oid: str, body: VoidIn, admin: dict = Depends(require_admin)):
    o = await db.orders.find_one({"id": oid})
    if not o:
        raise HTTPException(404, "Order tidak ditemukan")
    if o["status"] in ("void", "refunded"):
        raise HTTPException(400, "Order sudah dibatalkan/refund")
    new_status = "refunded" if body.action == "refund" else "void"
    # restore retail stock if it was paid
    if o["status"] == "paid":
        for it in o["items"]:
            if it["type"] == "retail":
                await db.products.update_one({"id": it["product_id"], "track_stock": True},
                                             {"$inc": {"stock": it["qty"]}})
    audit = {"id": new_id(), "order_id": oid, "order_number": o["order_number"],
             "action": body.action, "reason": body.reason, "prev_status": o["status"],
             "by": admin["name"], "by_id": admin["id"], "amount": o["total"],
             "at": now_utc().isoformat()}
    await db.audit_logs.insert_one(audit)
    await db.orders.update_one({"id": oid}, {"$set": {"status": new_status,
                                                      "voided_at": now_utc().isoformat(),
                                                      "void_reason": body.reason, "voided_by": admin["name"]}})
    audit.pop("_id", None)
    return {"status": new_status, "audit": audit}

@api.get("/audit-logs")
async def audit_logs(admin: dict = Depends(require_admin)):
    return await db.audit_logs.find({}, {"_id": 0}).sort("at", -1).to_list(500)

# ================================================================== SHIFTS
@api.get("/shifts/current")
async def current_shift(user: dict = Depends(get_current_user)):
    return await _current_shift(user)

@api.post("/shifts/open")
async def open_shift(body: ShiftOpenIn, user: dict = Depends(get_current_user)):
    if await _current_shift(user):
        raise HTTPException(400, "Sudah ada shift terbuka")
    doc = {"id": new_id(), "cashier_id": user["id"], "cashier_name": user["name"],
           "opening_cash": body.opening_cash, "status": "open",
           "opened_at": now_utc().isoformat(), "closed_at": None}
    await db.shifts.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.post("/shifts/close")
async def close_shift(body: ShiftCloseIn, user: dict = Depends(get_current_user)):
    shift = await _current_shift(user)
    if not shift:
        raise HTTPException(400, "Tidak ada shift terbuka")
    report = await _shift_report(shift)
    await db.shifts.update_one({"id": shift["id"]}, {"$set": {
        "status": "closed", "closed_at": now_utc().isoformat(),
        "closing_cash": body.closing_cash, "report": report}})
    return {**shift, "closing_cash": body.closing_cash, "report": report, "status": "closed"}

async def _shift_report(shift):
    orders = await db.orders.find({"shift_id": shift["id"], "status": "paid"}, {"_id": 0}).to_list(5000)
    by_type = {"dine_in": 0, "take_away": 0, "retail": 0}
    by_pm = {}
    total = 0
    for o in orders:
        by_type[o["order_type"]] = by_type.get(o["order_type"], 0) + o["total"]
        by_pm[o.get("payment_method_name", "?")] = by_pm.get(o.get("payment_method_name", "?"), 0) + o["total"]
        total += o["total"]
    cash = sum(o["total"] for o in orders if o.get("payment_method_type") == "cash")
    return {"order_count": len(orders), "total_sales": round(total, 2), "by_type": by_type,
            "by_payment": by_pm, "expected_cash": round(shift["opening_cash"] + cash, 2)}

@api.get("/shifts")
async def list_shifts(admin: dict = Depends(require_admin)):
    return await db.shifts.find({}, {"_id": 0}).sort("opened_at", -1).to_list(200)

# ================================================================== REPORTS
@api.get("/reports/summary")
async def report_summary(date_str: Optional[str] = Query(None, alias="date"),
                         admin: dict = Depends(require_admin)):
    d = date_str or wib_today()
    start, end = wib_day_range(d)
    q = {"status": "paid", "created_at": {"$gte": start, "$lt": end}}
    orders = await db.orders.find(q, {"_id": 0}).to_list(5000)
    by_type = {"dine_in": {"count": 0, "total": 0}, "take_away": {"count": 0, "total": 0}, "retail": {"count": 0, "total": 0}}
    by_pm = {}
    product_sales = {}
    total = 0
    total_discount = 0
    total_cost = 0
    prods = await db.products.find({}, {"_id": 0, "id": 1, "category_id": 1, "type": 1}).to_list(5000)
    prod_map = {p["id"]: p for p in prods}
    cats_all = await db.categories.find({}, {"_id": 0}).to_list(1000)
    cat_map = {c["id"]: c for c in cats_all}
    cat_sales = {}
    group_totals = {"makanan": 0, "minuman": 0, "retail": 0}
    for o in orders:
        bt = by_type[o["order_type"]]
        bt["count"] += 1
        bt["total"] += o["total"]
        total += o["total"]
        total_discount += o.get("discount", 0)
        by_pm[o.get("payment_method_name", "?")] = by_pm.get(o.get("payment_method_name", "?"), 0) + o["total"]
        for it in o["items"]:
            line = it["price"] * it["qty"]
            ps = product_sales.setdefault(it["name"], {"qty": 0, "total": 0, "cost": 0})
            ps["qty"] += it["qty"]
            ps["total"] += line
            ps["cost"] += it.get("cost", 0) * it["qty"]
            total_cost += it.get("cost", 0) * it["qty"]
            pinfo = prod_map.get(it.get("product_id"), {})
            itype = pinfo.get("type") or it.get("type") or "retail"
            if itype in group_totals:
                group_totals[itype] += line
            cid = pinfo.get("category_id")
            if cid:
                cinfo = cat_map.get(cid, {})
                cs = cat_sales.setdefault(cid, {"category_id": cid, "name": cinfo.get("name", "?"),
                                                "type": cinfo.get("type", itype), "qty": 0, "total": 0})
                cs["qty"] += it["qty"]
                cs["total"] += line
    top = []
    for k, v in sorted(product_sales.items(), key=lambda x: x[1]["total"], reverse=True)[:8]:
        profit = v["total"] - v["cost"]
        margin = round(profit / v["total"] * 100, 1) if v["total"] else 0
        top.append({"name": k, "qty": v["qty"], "total": round(v["total"], 2),
                    "cost": round(v["cost"], 2), "profit": round(profit, 2), "margin": margin})
    fnb_total = by_type["dine_in"]["total"] + by_type["take_away"]["total"]
    by_cat = sorted(cat_sales.values(), key=lambda x: x["total"], reverse=True)
    for c in by_cat:
        c["total"] = round(c["total"], 2)
    category_report = {
        "makanan": {"total": round(group_totals["makanan"], 2),
                    "categories": [c for c in by_cat if c["type"] == "makanan"]},
        "minuman": {"total": round(group_totals["minuman"], 2),
                    "categories": [c for c in by_cat if c["type"] == "minuman"]},
        "retail": {"total": round(group_totals["retail"], 2)},
    }
    low_stock = await db.products.aggregate([
        {"$match": {"track_stock": True, "active": True}},
        {"$addFields": {"eff_min": {"$ifNull": ["$min_stock", LOW_STOCK_THRESHOLD]}}},
        {"$match": {"$expr": {"$lte": ["$stock", "$eff_min"]}}},
        {"$project": {"_id": 0, "name": 1, "sku": 1, "stock": 1, "min_stock": "$eff_min"}},
        {"$sort": {"stock": 1}},
        {"$limit": 100},
    ]).to_list(100)
    cash_moves = await db.cash_movements.find({"created_at": {"$gte": start, "$lt": end}}, {"_id": 0}).to_list(2000)
    cash_in = sum(m["amount"] for m in cash_moves if m["type"] == "in")
    cash_out = sum(m["amount"] for m in cash_moves if m["type"] == "out")
    return {"date": d, "total_sales": round(total, 2), "order_count": len(orders),
            "total_discount": round(total_discount, 2), "by_type": by_type, "by_payment": by_pm,
            "fnb_total": round(fnb_total, 2), "retail_total": round(by_type["retail"]["total"], 2),
            "top_products": top, "low_stock": low_stock, "low_stock_threshold": LOW_STOCK_THRESHOLD,
            "total_cost": round(total_cost, 2), "gross_profit": round(total - total_cost, 2),
            "cash_in": round(cash_in, 2), "cash_out": round(cash_out, 2), "cash_net": round(cash_in - cash_out, 2),
            "category_report": category_report}

@api.get("/reports/range")
async def report_range(start: str, end: str, admin: dict = Depends(require_admin)):
    s_utc, _ = wib_day_range(start)
    _, e_utc = wib_day_range(end)
    q = {"status": "paid", "created_at": {"$gte": s_utc, "$lt": e_utc}}
    orders = await db.orders.find(q, {"_id": 0}).to_list(20000)
    daily = {}
    for o in orders:
        day = wib_day_of(o["created_at"])
        daily.setdefault(day, {"date": day, "total": 0, "count": 0})
        daily[day]["total"] += o["total"]
        daily[day]["count"] += 1
    return {"daily": sorted(daily.values(), key=lambda x: x["date"])}

# ================================================================== INVENTORY (Retail)
class PurchaseIn(BaseModel):
    product_id: str
    qty: int = Field(gt=0)
    unit_cost: float = Field(ge=0)
    note: Optional[str] = ""

@api.post("/purchases")
async def create_purchase(body: PurchaseIn, admin: dict = Depends(require_admin)):
    p = await db.products.find_one({"id": body.product_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Produk tidak ditemukan")
    if not p.get("track_stock"):
        raise HTTPException(400, "Pembelian stok hanya untuk produk retail")
    await db.products.update_one({"id": body.product_id},
                                 {"$inc": {"stock": body.qty}, "$set": {"cost": body.unit_cost}})
    doc = {"id": new_id(), "product_id": p["id"], "product_name": p["name"], "sku": p["sku"],
           "qty": body.qty, "unit_cost": body.unit_cost, "total_cost": round(body.qty * body.unit_cost, 2),
           "note": body.note, "by": admin["name"], "created_at": now_utc().isoformat()}
    await db.purchases.insert_one(doc)
    doc.pop("_id", None)
    return {**doc, "new_stock": p.get("stock", 0) + body.qty}

@api.get("/purchases")
async def list_purchases(date_str: Optional[str] = Query(None, alias="date"), admin: dict = Depends(require_admin)):
    q = {}
    if date_str:
        s, e = wib_day_range(date_str)
        q["created_at"] = {"$gte": s, "$lt": e}
    return await db.purchases.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)

class OpnameIn(BaseModel):
    product_id: str
    counted_stock: int = Field(ge=0)
    note: Optional[str] = ""

@api.post("/stock-opname")
async def create_opname(body: OpnameIn, admin: dict = Depends(require_admin)):
    p = await db.products.find_one({"id": body.product_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Produk tidak ditemukan")
    if not p.get("track_stock"):
        raise HTTPException(400, "Stok opname hanya untuk produk retail")
    system_stock = p.get("stock", 0)
    diff = body.counted_stock - system_stock
    await db.products.update_one({"id": body.product_id}, {"$set": {"stock": body.counted_stock}})
    doc = {"id": new_id(), "product_id": p["id"], "product_name": p["name"], "sku": p["sku"],
           "system_stock": system_stock, "counted_stock": body.counted_stock, "difference": diff,
           "note": body.note, "by": admin["name"], "created_at": now_utc().isoformat()}
    await db.stock_opname.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/stock-opname")
async def list_opname(date_str: Optional[str] = Query(None, alias="date"), admin: dict = Depends(require_admin)):
    q = {}
    if date_str:
        s, e = wib_day_range(date_str)
        q["created_at"] = {"$gte": s, "$lt": e}
    return await db.stock_opname.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)

# ================================================================== CASH MOVEMENTS
class CashIn(BaseModel):
    type: Literal["in", "out"]
    amount: float = Field(gt=0)
    category: str = "Lainnya"
    note: Optional[str] = ""

@api.post("/cash")
async def create_cash(body: CashIn, user: dict = Depends(get_current_user)):
    shift = await _current_shift(user)
    doc = {"id": new_id(), "type": body.type, "amount": body.amount, "category": body.category,
           "note": body.note, "cashier_id": user["id"], "cashier_name": user["name"],
           "shift_id": shift["id"] if shift else None, "created_at": now_utc().isoformat()}
    await db.cash_movements.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/cash")
async def list_cash(date_str: Optional[str] = Query(None, alias="date"), user: dict = Depends(get_current_user)):
    d = date_str or wib_today()
    s, e = wib_day_range(d)
    moves = await db.cash_movements.find({"created_at": {"$gte": s, "$lt": e}}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    cin = sum(m["amount"] for m in moves if m["type"] == "in")
    cout = sum(m["amount"] for m in moves if m["type"] == "out")
    return {"date": d, "movements": moves, "cash_in": round(cin, 2), "cash_out": round(cout, 2),
            "cash_net": round(cin - cout, 2)}

# ================================================================== SYNC (local outlet server <-> cloud)
class SyncPushIn(BaseModel):
    orders: List[OrderIn]

@api.get("/sync/master")
async def sync_master(user: dict = Depends(get_current_user)):
    """Pull master data snapshot for a local outlet server / offline client."""
    products = await db.products.find({}, {"_id": 0}).to_list(5000)
    categories = await db.categories.find({}, {"_id": 0}).to_list(500)
    tables = await db.tables.find({"deleted": {"$ne": True}}, {"_id": 0}).to_list(500)
    pms = await db.payment_methods.find({}, {"_id": 0}).to_list(100)
    return {"server_time": now_utc().isoformat(), "products": products, "categories": categories,
            "tables": tables, "payment_methods": pms}

@api.post("/sync/push")
async def sync_push(body: SyncPushIn, user: dict = Depends(get_current_user)):
    """Push a batch of offline orders to cloud. Idempotent via client_ref."""
    results = []
    synced = 0
    for o in body.orders:
        try:
            res = await create_order(o, user)
            synced += 1
            results.append({"client_ref": o.client_ref, "status": "ok", "order_number": res.get("order_number")})
        except HTTPException as e:
            results.append({"client_ref": o.client_ref, "status": "error", "detail": e.detail})
    return {"synced": synced, "total": len(body.orders), "results": results, "server_time": now_utc().isoformat()}

# ================================================================== AI
def _get_chat(session, system, model):
    from emergentintegrations.llm.chat import LlmChat
    return LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session, system_message=system).with_model("gemini", model)

AI_FEATURES = {"description": "Deskripsi Produk", "image": "Gambar Produk", "summary": "Analisis Laporan", "vision": "Baca Faktur (Vision)"}

async def _ai_cfg(feature="description"):
    """Per-feature AI provider config: DB settings (editable in UI) override .env.
    Fallback order: feature-specific -> legacy flat -> .env defaults."""
    doc = await db.settings.find_one({"_id": "ai"}) or {}
    feat = (doc.get("features", {}) or {}).get(feature, {}) or {}
    return {
        "base_url": feat.get("base_url") or doc.get("openai_base_url") or OPENAI_COMPAT_BASE_URL,
        "api_key": feat.get("api_key") or doc.get("openai_api_key") or OPENAI_COMPAT_API_KEY,
        "model": feat.get("model") or doc.get("openai_model") or OPENAI_COMPAT_MODEL,
    }

async def _gemini_text(system, prompt, feature="description"):
    """Text via OpenAI-compatible provider if configured, else user's Gemini key, else Emergent."""
    cfg = await _ai_cfg(feature)
    if cfg["api_key"] and cfg["base_url"]:
        from openai import OpenAI

        def run():
            client = OpenAI(api_key=cfg["api_key"], base_url=cfg["base_url"])
            r = client.chat.completions.create(
                model=cfg["model"],
                messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
                temperature=0.5, max_tokens=4000,
            )
            msg = r.choices[0].message
            content = (msg.content or "").strip()
            if not content:  # some reasoning models return text in reasoning_content
                content = (getattr(msg, "reasoning_content", "") or "").strip()
            return content
        return await asyncio.to_thread(run)
    if GEMINI_API_KEY:
        from google import genai
        from google.genai import types

        def run():
            client = genai.Client(api_key=GEMINI_API_KEY)
            r = client.models.generate_content(
                model=GEMINI_TEXT_MODEL, contents=f"{system}\n\n{prompt}",
                config=types.GenerateContentConfig(temperature=0.5, max_output_tokens=800),
            )
            return (r.text or "").strip()
        return await asyncio.to_thread(run)
    from emergentintegrations.llm.chat import UserMessage
    chat = _get_chat(new_id(), system, "gemini-2.5-flash")
    return (await chat.send_message(UserMessage(text=prompt))).strip()

async def _gemini_image(prompt):
    """Image via OpenAI-compatible image endpoint (only when explicitly configured for 'image'),
    else user's own Gemini key, else Emergent universal key."""
    doc = await db.settings.find_one({"_id": "ai"}) or {}
    feat = (doc.get("features", {}) or {}).get("image", {}) or {}
    if feat.get("api_key") and feat.get("base_url") and feat.get("model"):
        from openai import OpenAI

        def run():
            client = OpenAI(api_key=feat["api_key"], base_url=feat["base_url"])
            r = client.images.generate(model=feat["model"], prompt=prompt, n=1, size="1024x1024")
            d = r.data[0]
            b64 = getattr(d, "b64_json", None)
            if b64:
                return f"data:image/png;base64,{b64}"
            return getattr(d, "url", None)
        return await asyncio.to_thread(run)
    if GEMINI_API_KEY:
        from google import genai
        from google.genai import types
        import base64

        def run():
            client = genai.Client(api_key=GEMINI_API_KEY)
            r = client.models.generate_content(
                model=GEMINI_IMAGE_MODEL, contents=prompt,
                config=types.GenerateContentConfig(response_modalities=["IMAGE", "TEXT"]),
            )
            for cand in (r.candidates or []):
                for part in (cand.content.parts or []):
                    inline = getattr(part, "inline_data", None)
                    if inline and inline.data:
                        data = inline.data
                        b64 = base64.b64encode(data).decode() if isinstance(data, (bytes, bytearray)) else data
                        return f"data:{inline.mime_type or 'image/png'};base64,{b64}"
            return None
        return await asyncio.to_thread(run)
    from emergentintegrations.llm.chat import UserMessage
    chat = _get_chat(new_id(), "You are a professional food & product photographer.",
                     "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    _, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
    if images:
        img = images[0]
        return f"data:{img['mime_type']};base64,{img['data']}"
    return None

class AISettingsIn(BaseModel):
    feature: Literal["description", "image", "summary"]
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None

def _mask_key(k):
    if not k:
        return ""
    return "••••" + k[-4:] if len(k) >= 4 else "••••"

@api.get("/settings/ai")
async def get_ai_settings(admin: dict = Depends(require_admin)):
    doc = await db.settings.find_one({"_id": "ai"}) or {}
    feats = doc.get("features", {}) or {}
    out = {}
    for key, label in AI_FEATURES.items():
        f = feats.get(key, {}) or {}
        if key == "image":
            # Image generation only activates with explicit per-feature config;
            # never fall back to the legacy/env text model (not a valid image model).
            akey = f.get("api_key")
            base = f.get("base_url") or ""
            model = f.get("model") or ""
        else:
            akey = f.get("api_key") or doc.get("openai_api_key") or OPENAI_COMPAT_API_KEY
            base = f.get("base_url") or doc.get("openai_base_url") or OPENAI_COMPAT_BASE_URL or ""
            model = f.get("model") or doc.get("openai_model") or (OPENAI_COMPAT_MODEL if akey else "") or ""
        out[key] = {"label": label, "base_url": base, "model": model,
                    "api_key_set": bool(akey), "api_key_last4": _mask_key(akey)}
    return {"features": out}

@api.put("/settings/ai")
async def put_ai_settings(body: AISettingsIn, admin: dict = Depends(require_admin)):
    upd = {}
    if body.base_url is not None:
        upd[f"features.{body.feature}.base_url"] = body.base_url.strip()
    if body.model is not None:
        upd[f"features.{body.feature}.model"] = body.model.strip()
    if body.api_key:  # only overwrite key when a new one is provided
        upd[f"features.{body.feature}.api_key"] = body.api_key.strip()
    if upd:
        await db.settings.update_one({"_id": "ai"}, {"$set": upd}, upsert=True)
    return {"ok": True}

@api.get("/settings/ai/credit")
async def ai_credit(feature: str = "description", admin: dict = Depends(require_admin)):
    """Best-effort remaining credit lookup via OpenAI-compatible billing endpoints."""
    import httpx, datetime as _dt
    cfg = await _ai_cfg(feature)
    if not (cfg["api_key"] and cfg["base_url"]):
        return {"available": False, "message": "Konfigurasi belum lengkap untuk fitur ini."}
    base = cfg["base_url"].rstrip("/")
    headers = {"Authorization": f"Bearer {cfg['api_key']}"}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            sub = await client.get(f"{base}/dashboard/billing/subscription", headers=headers)
            if sub.status_code != 200:
                return {"available": False, "message": f"Provider tidak menyediakan info kredit (HTTP {sub.status_code})."}
            s = sub.json()
            total = s.get("hard_limit_usd") or s.get("system_hard_limit_usd") or 0
            used = 0.0
            try:
                end = _dt.date.today() + _dt.timedelta(days=1)
                start = end - _dt.timedelta(days=100)
                u = await client.get(f"{base}/dashboard/billing/usage", headers=headers,
                                     params={"start_date": str(start), "end_date": str(end)})
                if u.status_code == 200:
                    used = (u.json().get("total_usage") or 0) / 100.0
            except Exception:
                pass
            return {"available": True, "total": round(float(total), 2), "used": round(used, 2),
                    "remaining": round(float(total) - used, 2), "currency": "USD"}
    except Exception as e:
        return {"available": False, "message": f"Gagal cek kredit: {e}"}

import json as _json, re as _re

def _num(v):
    if isinstance(v, (int, float)):
        return float(v)
    s = _re.sub(r"[^0-9]", "", str(v))
    return float(s) if s else 0.0

def _extract_json_list(text):
    t = (text or "").strip()
    m = _re.search(r"\[.*\]", t, _re.S)
    if m:
        t = m.group(0)
    try:
        data = _json.loads(t)
    except Exception:
        return []
    out = []
    for d in (data if isinstance(data, list) else []):
        if not isinstance(d, dict):
            continue
        name = str(d.get("name", "")).strip()
        if name:
            out.append({"name": name, "qty": _num(d.get("qty", 1)) or 1, "unit_cost": _num(d.get("unit_cost", 0))})
    return out

class AIInvoiceIn(BaseModel):
    image: str

@api.post("/ai/parse-invoice")
async def ai_parse_invoice(body: AIInvoiceIn, admin: dict = Depends(require_admin)):
    cfg = await _ai_cfg("vision")
    if not (cfg["api_key"] and cfg["base_url"] and cfg["model"]):
        raise HTTPException(400, "Konfigurasi AI 'Baca Faktur (Vision)' belum lengkap di Pengaturan AI")
    img = body.image if body.image.startswith("data:") else f"data:image/jpeg;base64,{body.image}"
    system = "Anda asisten yang membaca foto faktur/nota pembelian toko."
    prompt = ('Baca foto faktur berikut dan ekstrak daftar barang. Kembalikan HANYA JSON array. '
              'Tiap elemen: {"name": "nama barang", "qty": angka, "unit_cost": angka}. '
              'unit_cost = harga beli per unit (Rupiah, angka saja tanpa titik/koma). Tanpa teks lain.')
    from openai import OpenAI

    def run():
        client = OpenAI(api_key=cfg["api_key"], base_url=cfg["base_url"])
        r = client.chat.completions.create(
            model=cfg["model"],
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": img}},
                ]},
            ],
            max_tokens=1500, temperature=0,
        )
        return r.choices[0].message.content or ""
    try:
        raw = await asyncio.to_thread(run)
    except Exception as e:
        logger.error(f"parse-invoice AI error: {e}")
        raise HTTPException(400, "Model AI yang dipilih tidak mendukung pembacaan gambar. Ganti model Vision di Pengaturan AI.")
    return {"items": _extract_json_list(raw)}

@api.post("/ai/product-description")
async def ai_description(body: AIDescIn, admin: dict = Depends(require_admin)):
    try:
        system = "Anda copywriter menu F&B & retail Indonesia. Tulis deskripsi produk singkat, menggugah selera, maksimal 2 kalimat, bahasa Indonesia. Jangan pakai emoji."
        prompt = f"Produk: {body.name}\nTipe: {body.type}\nKategori: {body.category}\nKata kunci: {body.keywords}\nTulis deskripsi produk."
        text = await _gemini_text(system, prompt, "description")
        return {"description": text}
    except Exception as e:
        logger.error(f"AI desc error: {e}")
        raise HTTPException(500, f"AI gagal: {e}")

@api.post("/ai/product-image")
async def ai_image(body: AIImageIn, admin: dict = Depends(require_admin)):
    try:
        prompt = f"Professional appetizing product photo of '{body.name}'. {body.description}. Clean studio background, top menu photography, high detail, no text overlay."
        image = await _gemini_image(prompt)
        if not image:
            raise HTTPException(500, "Tidak ada gambar dihasilkan")
        return {"image": image}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI image error: {e}")
        msg = str(e)
        if "RESOURCE_EXHAUSTED" in msg or "429" in msg:
            raise HTTPException(429, "Gambar AI belum aktif di akun Gemini Anda (kuota gambar free tier = 0). Aktifkan billing di Google Cloud/AI Studio untuk memakainya, atau unggah gambar produk secara manual.")
        raise HTTPException(500, f"AI gambar gagal: {e}")

@api.post("/reports/ai-summary")
async def ai_summary(body: AISummaryIn, admin: dict = Depends(require_admin)):
    from emergentintegrations.llm.chat import UserMessage
    d = body.date or now_utc().strftime("%Y-%m-%d")
    summary = await report_summary(date_str=d, admin=admin)
    try:
        system = ("Anda analis bisnis F&B & retail. Tulis LAPORAN penjualan harian dalam bahasa Indonesia yang tegas dan actionable. "
                  "Struktur: (1) Ringkasan singkat, (2) Sorotan per kategori (Makanan/Minuman/Retail), (3) 2-3 insight, (4) 1-2 rekomendasi. Tanpa emoji.")
        cr = summary.get("category_report", {})
        mk, mn, rt = cr.get("makanan", {}), cr.get("minuman", {}), cr.get("retail", {})

        def _cats(g):
            return ", ".join(f"{c['name']} Rp{c['total']:,.0f}" for c in g.get("categories", [])[:6]) or "-"
        prompt = (f"Data penjualan {d}:\n"
                  f"Total: Rp{summary['total_sales']:,.0f} dari {summary['order_count']} order. Laba kotor: Rp{summary['gross_profit']:,.0f}.\n"
                  f"Dine-in: Rp{summary['by_type']['dine_in']['total']:,.0f}; Take away: Rp{summary['by_type']['take_away']['total']:,.0f}; Retail: Rp{summary['by_type']['retail']['total']:,.0f}.\n"
                  f"Makanan Rp{mk.get('total', 0):,.0f} (rincian: {_cats(mk)}).\n"
                  f"Minuman Rp{mn.get('total', 0):,.0f} (rincian: {_cats(mn)}).\n"
                  f"Retail gabungan Rp{rt.get('total', 0):,.0f}.\n"
                  f"Total diskon: Rp{summary['total_discount']:,.0f}. Kas masuk: Rp{summary['cash_in']:,.0f}, kas keluar: Rp{summary['cash_out']:,.0f}.\n"
                  f"Produk terlaris: {', '.join(p['name'] for p in summary['top_products'][:5])}.\n"
                  f"Stok retail menipis: {len(summary.get('low_stock', []))} produk.\n"
                  f"Buat laporan analitik.")
        text = await _gemini_text(system, prompt, "summary")
        return {"date": d, "summary": text, "data": summary}
    except Exception as e:
        logger.error(f"AI summary error: {e}")
        raise HTTPException(500, f"AI ringkasan gagal: {e}")

# ================================================================== REPORT EXPORT & WHATSAPP
WA_SERVICE_URL = os.environ.get('WA_SERVICE_URL')
WA_SECRET = os.environ.get('WA_SECRET')
WEBHOOK_CRON_SECRET = os.environ.get('WEBHOOK_CRON_SECRET')

async def _wa_call(method, path, **kw):
    import httpx
    if not WA_SERVICE_URL:
        raise HTTPException(400, "Layanan WhatsApp tidak aktif")
    headers = {"x-wa-secret": WA_SECRET or ""}
    async with httpx.AsyncClient(timeout=30) as c:
        return await c.request(method, f"{WA_SERVICE_URL.rstrip('/')}{path}", headers=headers, **kw)

async def _wa_ready():
    try:
        r = await _wa_call("GET", "/status")
        return bool(r.json().get("ready"))
    except Exception:
        return False

def _report_lines(d, s, ai_text=None):
    cr = s.get("category_report", {})
    L = ["*Laporan Grand Aceh Kuliner*", f"Tanggal: {d}", "",
         f"Total Penjualan: Rp{s['total_sales']:,.0f}",
         f"Jumlah Order: {s['order_count']}",
         f"Laba Kotor: Rp{s['gross_profit']:,.0f}",
         f"Total Diskon: Rp{s['total_discount']:,.0f}", "",
         "Per Kategori:",
         f"- Makanan: Rp{cr.get('makanan', {}).get('total', 0):,.0f}",
         f"- Minuman: Rp{cr.get('minuman', {}).get('total', 0):,.0f}",
         f"- Retail: Rp{cr.get('retail', {}).get('total', 0):,.0f}"]
    if s.get("by_payment"):
        L += ["", "Metode Bayar:"] + [f"- {k}: Rp{v:,.0f}" for k, v in s["by_payment"].items()]
    if s.get("top_products"):
        L += ["", "Produk Terlaris:"] + [f"- {p['name']} (x{p['qty']})" for p in s["top_products"][:5]]
    if ai_text:
        L += ["", "Analisis AI:", ai_text]
    return L

def _report_excel(d, s):
    import openpyxl
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Laporan"
    for ln in _report_lines(d, s):
        ws.append([ln.replace("*", "")])
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    return buf

def _report_pdf(d, s, ai_text=None):
    from fpdf import FPDF
    pdf = FPDF(); pdf.add_page(); pdf.set_font("Helvetica", size=12)
    for ln in _report_lines(d, s, ai_text):
        txt = ln.replace("*", "").encode("latin-1", "replace").decode("latin-1")
        pdf.multi_cell(pdf.epw, 7, txt or " ")
    return io.BytesIO(bytes(pdf.output()))

@api.get("/reports/export/excel")
async def export_report_excel(date_str: Optional[str] = Query(None, alias="date"), user: dict = Depends(get_current_user)):
    d = date_str or wib_today()
    s = await report_summary(date_str=d, admin=user)
    return StreamingResponse(_report_excel(d, s), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f"attachment; filename=laporan-{d}.xlsx"})

@api.get("/reports/export/pdf")
async def export_report_pdf(date_str: Optional[str] = Query(None, alias="date"), user: dict = Depends(get_current_user)):
    d = date_str or wib_today()
    s = await report_summary(date_str=d, admin=user)
    return StreamingResponse(_report_pdf(d, s), media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=laporan-{d}.pdf"})

class ReportSettingsIn(BaseModel):
    whatsapp_enabled: bool = False
    whatsapp_time: str = "22:00"
    recipients: List[str] = []
    include_ai: bool = True

@api.get("/settings/report")
async def get_report_settings(admin: dict = Depends(require_admin)):
    doc = await db.settings.find_one({"_id": "report"}, {"_id": 0}) or {}
    return {
        "whatsapp_enabled": doc.get("whatsapp_enabled", False),
        "whatsapp_time": doc.get("whatsapp_time", "22:00"),
        "recipients": doc.get("recipients", []),
        "include_ai": doc.get("include_ai", True),
        "whatsapp_configured": await _wa_ready(),
        "last_sent_date": doc.get("last_sent_date"),
    }

@api.put("/settings/report")
async def put_report_settings(body: ReportSettingsIn, admin: dict = Depends(require_admin)):
    await db.settings.update_one({"_id": "report"}, {"$set": {
        "whatsapp_enabled": body.whatsapp_enabled, "whatsapp_time": body.whatsapp_time,
        "recipients": [r.strip() for r in body.recipients if r.strip()], "include_ai": body.include_ai,
    }}, upsert=True)
    return {"ok": True}

async def _send_whatsapp(recipients, text):
    out = []
    for to in recipients:
        try:
            r = await _wa_call("POST", "/send", json={"to": to, "message": text})
            if r.status_code == 200:
                out.append({"to": to, "ok": True, "id": r.json().get("id")})
            else:
                out.append({"to": to, "ok": False, "error": r.json().get("error", r.text)})
        except Exception as e:
            out.append({"to": to, "ok": False, "error": str(e)})
    return out

class WhatsAppSendIn(BaseModel):
    date: Optional[str] = None
    recipients: Optional[List[str]] = None

@api.post("/reports/send-whatsapp")
async def send_report_whatsapp(body: WhatsAppSendIn, admin: dict = Depends(require_admin)):
    d = body.date or wib_today()
    s = await report_summary(date_str=d, admin=admin)
    doc = await db.settings.find_one({"_id": "report"}) or {}
    recips = body.recipients or doc.get("recipients", [])
    if not recips:
        raise HTTPException(400, "Belum ada nomor WhatsApp tujuan. Atur di Pengaturan.")
    ai_text = None
    if doc.get("include_ai", True):
        try:
            r = await ai_summary(AISummaryIn(date=d), admin=admin)
            ai_text = r.get("summary")
        except Exception:
            ai_text = None
    text = "\n".join(_report_lines(d, s, ai_text))
    result = await _send_whatsapp(recips, text)
    if not any(r.get("ok") for r in result):
        raise HTTPException(400, f"Gagal kirim WhatsApp: {result[0].get('error') if result else 'tidak diketahui'}")
    return {"sent": result}

async def _run_daily_report_job():
    doc = await db.settings.find_one({"_id": "report"}) or {}
    if not doc.get("whatsapp_enabled") or not doc.get("recipients"):
        return
    noww = datetime.now(WIB)
    try:
        target_hour = int(str(doc.get("whatsapp_time", "22:00")).split(":")[0])
    except Exception:
        target_hour = 22
    if noww.hour != target_hour:
        return
    today = noww.strftime("%Y-%m-%d")
    if doc.get("last_sent_date") == today:
        return
    s = await report_summary(date_str=today, admin={"role": "admin", "id": "cron"})
    ai_text = None
    if doc.get("include_ai", True):
        try:
            r = await ai_summary(AISummaryIn(date=today), admin={"role": "admin", "id": "cron"})
            ai_text = r.get("summary")
        except Exception:
            pass
    text = "\n".join(_report_lines(today, s, ai_text))
    try:
        await _send_whatsapp(doc["recipients"], text)
        await db.settings.update_one({"_id": "report"}, {"$set": {"last_sent_date": today}}, upsert=True)
        logger.info(f"Daily WA report sent for {today}")
    except Exception as e:
        logger.error(f"Daily WA report failed: {e}")

@api.post("/cron/daily-report")
async def cron_daily_report(request: Request, background: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    import hmac as _hmac
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else ""
    if not (WEBHOOK_CRON_SECRET and _hmac.compare_digest(token, WEBHOOK_CRON_SECRET)):
        raise HTTPException(401, "unauthorized")
    background.add_task(_run_daily_report_job)
    return {"ok": True}

# ---- WhatsApp Web (whatsapp-web.js) proxy: QR login + chat ----
class WAChatSendIn(BaseModel):
    to: str
    message: str

@api.get("/whatsapp/status")
async def whatsapp_status(admin: dict = Depends(require_admin)):
    try:
        r = await _wa_call("GET", "/status")
        return r.json()
    except Exception as e:
        return {"ready": False, "qr": None, "error": str(e)}

@api.get("/whatsapp/chats")
async def whatsapp_chats(admin: dict = Depends(require_admin)):
    r = await _wa_call("GET", "/chats")
    if r.status_code != 200:
        raise HTTPException(r.status_code, r.json().get("error", "gagal memuat chat"))
    return r.json()

@api.get("/whatsapp/messages")
async def whatsapp_messages(chatId: str, admin: dict = Depends(require_admin)):
    r = await _wa_call("GET", "/messages", params={"chatId": chatId})
    if r.status_code != 200:
        raise HTTPException(r.status_code, r.json().get("error", "gagal memuat pesan"))
    return r.json()

@api.post("/whatsapp/send")
async def whatsapp_send(body: WAChatSendIn, admin: dict = Depends(require_admin)):
    r = await _wa_call("POST", "/send", json={"to": body.to, "message": body.message})
    if r.status_code != 200:
        raise HTTPException(r.status_code, r.json().get("error", "gagal mengirim"))
    return r.json()

@api.post("/whatsapp/logout")
async def whatsapp_logout(admin: dict = Depends(require_admin)):
    r = await _wa_call("POST", "/logout")
    return r.json()

# ================================================================== EXCEL
IMPORT_COLUMNS = ["nama_produk", "sku", "kategori", "tipe_produk", "harga", "harga_beli", "status_aktif", "sold_out", "deskripsi", "stok_awal"]

@api.get("/products/template")
async def download_template(user: dict = Depends(get_current_user)):
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Produk"
    ws.append(IMPORT_COLUMNS)
    ws.append(["Nasi Goreng Aceh", "FD-001", "Makanan Utama", "makanan", 25000, 12000, "aktif", "tidak", "Nasi goreng khas Aceh", 0])
    ws.append(["Kopi Sanger", "DR-001", "Minuman", "minuman", 15000, 6000, "aktif", "tidak", "Kopi susu khas Aceh", 0])
    ws.append(["Keripik Pisang", "RT-001", "Snack Retail", "retail", 12000, 8000, "aktif", "tidak", "Keripik pisang kemasan", 50])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=template_produk_gak.xlsx"})

@api.get("/products/export")
async def export_products(admin: dict = Depends(require_admin)):
    import openpyxl
    cats = {c["id"]: c["name"] for c in await db.categories.find({}, {"_id": 0}).to_list(500)}
    products = await db.products.find({}, {"_id": 0}).sort("name", 1).to_list(5000)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Produk"
    ws.append(IMPORT_COLUMNS)
    for p in products:
        ws.append([p["name"], p["sku"], cats.get(p["category_id"], ""), p["type"], p["price"], p.get("cost", 0),
                   "aktif" if p.get("active") else "nonaktif", "ya" if p.get("sold_out") else "tidak",
                   p.get("description", ""), p.get("stock", 0)])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=produk_gak.xlsx"})

async def _parse_import(file_bytes):
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return [], ["File kosong"]
    header = [str(h).strip().lower() if h else "" for h in rows[0]]
    cats = {c["name"].strip().lower(): c for c in await db.categories.find({}, {"_id": 0}).to_list(500)}
    existing_skus = {p["sku"] for p in await db.products.find({}, {"_id": 0, "sku": 1}).to_list(5000)}
    parsed = []
    seen_skus = set()
    for idx, raw in enumerate(rows[1:], start=2):
        row = {header[i]: raw[i] if i < len(raw) else None for i in range(len(header))}
        errors = []
        name = str(row.get("nama_produk") or "").strip()
        sku = str(row.get("sku") or "").strip()
        cat_name = str(row.get("kategori") or "").strip()
        ptype = str(row.get("tipe_produk") or "").strip().lower()
        if not name:
            errors.append("nama produk kosong")
        if not sku:
            errors.append("SKU kosong")
        elif sku in seen_skus:
            errors.append(f"SKU '{sku}' duplikat di file")
        seen_skus.add(sku)
        cat = cats.get(cat_name.lower())
        if not cat:
            errors.append(f"kategori '{cat_name}' tidak valid")
        if ptype not in PRODUCT_TYPES:
            errors.append(f"tipe '{ptype}' tidak valid (makanan/minuman/retail)")
        elif cat and cat["type"] != ptype:
            errors.append(f"tipe produk '{ptype}' tidak sesuai tipe kategori '{cat['type']}'")
        try:
            price = float(row.get("harga") or 0)
            if price < 0:
                errors.append("harga negatif")
        except (ValueError, TypeError):
            price = 0
            errors.append("harga bukan angka")
        try:
            cost = float(row.get("harga_beli") or 0)
            if cost < 0:
                cost = 0
        except (ValueError, TypeError):
            cost = 0
        try:
            stock = int(float(row.get("stok_awal") or 0))
        except (ValueError, TypeError):
            stock = 0
        active = str(row.get("status_aktif") or "aktif").strip().lower() in ("aktif", "aktif ", "ya", "true", "1", "active")
        sold_out = str(row.get("sold_out") or "tidak").strip().lower() in ("ya", "true", "1", "sold out", "soldout")
        parsed.append({
            "row": idx, "name": name, "sku": sku, "category_id": cat["id"] if cat else None,
            "category_name": cat_name, "type": ptype, "price": price, "cost": cost, "stock": stock,
            "description": str(row.get("deskripsi") or ""), "active": active, "sold_out": sold_out,
            "exists": sku in existing_skus, "errors": errors, "valid": len(errors) == 0,
        })
    return parsed, []

@api.post("/products/import/preview")
async def import_preview(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    content = await file.read()
    parsed, file_errors = await _parse_import(content)
    if file_errors:
        raise HTTPException(400, file_errors[0])
    valid = [p for p in parsed if p["valid"]]
    return {"rows": parsed, "total": len(parsed), "valid_count": len(valid),
            "error_count": len(parsed) - len(valid),
            "new_count": len([p for p in valid if not p["exists"]]),
            "update_count": len([p for p in valid if p["exists"]])}

@api.post("/products/import/commit")
async def import_commit(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    content = await file.read()
    parsed, file_errors = await _parse_import(content)
    if file_errors:
        raise HTTPException(400, file_errors[0])
    created = updated = 0
    for p in parsed:
        if not p["valid"]:
            continue
        doc = {"name": p["name"], "sku": p["sku"], "category_id": p["category_id"], "type": p["type"],
               "price": p["price"], "cost": p["cost"], "description": p["description"], "active": p["active"],
               "sold_out": p["sold_out"], "stock": p["stock"], "track_stock": p["type"] == "retail",
               "image": ""}
        if p["exists"]:
            await db.products.update_one({"sku": p["sku"]}, {"$set": doc})
            updated += 1
        else:
            doc.update({"id": new_id(), "created_at": now_utc().isoformat()})
            await db.products.insert_one(doc)
            created += 1
    log = {"id": new_id(), "filename": file.filename, "at": now_utc().isoformat(), "by": admin["name"],
           "created": created, "updated": updated, "errors": len([p for p in parsed if not p["valid"]])}
    await db.import_logs.insert_one(log)
    log.pop("_id", None)
    return log

@api.get("/import-logs")
async def import_logs(admin: dict = Depends(require_admin)):
    return await db.import_logs.find({}, {"_id": 0}).sort("at", -1).to_list(100)

# ------------------------------------------------------------------ startup
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.products.create_index("sku", unique=True)
    await db.orders.create_index("client_ref", sparse=True)
    await db.orders.create_index([("order_type", 1), ("status", 1)])
    await db.orders.create_index([("created_at", -1)])
    await db.products.create_index([("type", 1), ("active", 1)])
    await db.products.create_index([("category_id", 1)])
    try:
        await db.orders.create_index("order_number", unique=True)
    except Exception as e:
        logger.warning(f"order_number unique index not applied (resolve duplicates): {e}")
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_pw = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({"id": new_id(), "name": os.environ.get("ADMIN_NAME", "Admin"),
                                   "email": admin_email, "password_hash": hash_password(admin_pw),
                                   "role": "admin", "active": True, "created_at": now_utc().isoformat()})
    elif not verify_password(admin_pw, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pw)}})
    # seed a cashier
    if not await db.users.find_one({"email": "kasir@grandaceh.com"}):
        await db.users.insert_one({"id": new_id(), "name": "Kasir Satu", "email": "kasir@grandaceh.com",
                                   "password_hash": hash_password("kasir123"), "role": "kasir",
                                   "active": True, "created_at": now_utc().isoformat()})
    # seed payment methods
    if await db.payment_methods.count_documents({}) == 0:
        for n, t in [("Cash", "cash"), ("QRIS", "qris"), ("Kartu Debit/Kredit", "card")]:
            await db.payment_methods.insert_one({"id": new_id(), "name": n, "type": t, "active": True})
    logger.info("Startup seeding complete")

@app.on_event("shutdown")
async def shutdown():
    client.close()

app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
