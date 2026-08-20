"""Seed durable UI test data for iteration 8 frontend tests + close admin shift so the gate shows."""
import requests
from dotenv import dotenv_values

API = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
tok = requests.post(f"{API}/auth/login", json={"email": "taqim2609@gmail.com", "password": "GrandAceh#2026"}).json()["token"]
S = requests.Session()
S.headers.update({"Authorization": f"Bearer {tok}"})


def cat(name, ctype):
    for c in S.get(f"{API}/categories", params={"include_inactive": True}).json():
        if c["name"] == name:
            return c
    r = S.post(f"{API}/categories", json={"name": name, "type": ctype, "sort_order": 1})
    print("cat", name, r.status_code)
    return r.json()


def prod(name, c, price, cost, sku, stock=0):
    for p in S.get(f"{API}/products").json():
        if p["sku"] == sku:
            return p
    r = S.post(f"{API}/products", json={"name": name, "sku": sku, "category_id": c["id"], "type": c["type"],
                                        "price": price, "cost": cost, "stock": stock, "min_stock": 2})
    print("prod", name, r.status_code, r.text[:200])
    return r.json()


cm = cat("UI Makanan", "makanan")
cd = cat("UI Minuman", "minuman")
cr = cat("UI Retail", "retail")
prod("UI Nasi Goreng", cm, 30000, 12000, "UIFOOD1")
prod("UI Es Teh", cd, 6000, 1500, "UIDRINK1")
prod("UI Sabun", cr, 12000, 9000, "UIRETAIL1", stock=100)

cur = S.get(f"{API}/shifts/current").json()
if cur:
    r = S.post(f"{API}/shifts/close", json={"closing_cash": cur["opening_cash"]})
    print("closed shift", r.status_code)
print("current shift:", S.get(f"{API}/shifts/current").json())
