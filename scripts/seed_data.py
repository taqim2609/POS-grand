import requests, os

API = os.popen("grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2").read().strip() + "/api"
tok = requests.post(f"{API}/auth/login", json={"email": "taqim2609@gmail.com", "password": "GrandAceh#2026"}).json()["token"]
H = {"Authorization": f"Bearer {tok}"}

# categories
cats_def = [
    ("Makanan Utama", "makanan", 1), ("Cemilan", "makanan", 2),
    ("Kopi", "minuman", 3), ("Non-Kopi", "minuman", 4),
    ("Snack Retail", "retail", 5), ("Minuman Kemasan", "retail", 6),
]
existing = {c["name"]: c for c in requests.get(f"{API}/categories", headers=H).json()}
cat_ids = {}
for name, typ, order in cats_def:
    if name in existing:
        cat_ids[name] = existing[name]["id"]; continue
    r = requests.post(f"{API}/categories", headers=H, json={"name": name, "type": typ, "sort_order": order, "active": True})
    cat_ids[name] = r.json()["id"]

# products
prods = [
    ("Nasi Goreng Aceh", "FD-001", "Makanan Utama", "makanan", 28000, 0),
    ("Mie Aceh Goreng", "FD-002", "Makanan Utama", "makanan", 30000, 0),
    ("Ayam Tangkap", "FD-003", "Makanan Utama", "makanan", 45000, 0),
    ("Roti Cane Kari", "FD-004", "Cemilan", "makanan", 18000, 0),
    ("Pisang Goreng", "FD-005", "Cemilan", "makanan", 12000, 0),
    ("Kopi Sanger", "DR-001", "Kopi", "minuman", 15000, 0),
    ("Kopi Espresso", "DR-002", "Kopi", "minuman", 18000, 0),
    ("Es Timun Serut", "DR-003", "Non-Kopi", "minuman", 14000, 0),
    ("Teh Tarik", "DR-004", "Non-Kopi", "minuman", 12000, 0),
    ("Keripik Pisang 100g", "RT-001", "Snack Retail", "retail", 15000, 50),
    ("Kopi Bubuk Aceh 250g", "RT-002", "Snack Retail", "retail", 45000, 30),
    ("Air Mineral 600ml", "RT-003", "Minuman Kemasan", "retail", 5000, 100),
    ("Teh Botol", "RT-004", "Minuman Kemasan", "retail", 6000, 80),
]
existing_sku = {p["sku"] for p in requests.get(f"{API}/products", headers=H).json()}
for name, sku, cat, typ, price, stock in prods:
    if sku in existing_sku: continue
    requests.post(f"{API}/products", headers=H, json={
        "name": name, "sku": sku, "category_id": cat_ids[cat], "type": typ,
        "price": price, "description": "", "image": "", "active": True, "sold_out": False, "stock": stock})

# tables
tables = [("Meja 1","Indoor",4),("Meja 2","Indoor",4),("Meja 3","Indoor",2),("Meja 4","Indoor",6),
          ("VIP 1","VIP",8),("VIP 2","VIP",8),("Out 1","Outdoor",4),("Out 2","Outdoor",4)]
existing_t = {t["name"] for t in requests.get(f"{API}/tables", headers=H).json()}
for name, area, cap in tables:
    if name in existing_t: continue
    requests.post(f"{API}/tables", headers=H, json={"name": name, "area": area, "capacity": cap, "active": True})

print("Seed done:", len(requests.get(f"{API}/products", headers=H).json()), "products,",
      len(requests.get(f"{API}/tables", headers=H).json()), "tables")
