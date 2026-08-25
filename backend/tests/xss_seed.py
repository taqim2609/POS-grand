"""Seed a product with HTML-special chars to verify receipt XSS escaping; --clean removes it."""
import sys
import requests
from dotenv import dotenv_values

BASE = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
NAME = 'TEST_XSS <img src=x onerror=alert(1)> & "q"'

tok = requests.post(f"{BASE}/auth/login", json={"email": "taqim2609@gmail.com", "password": "GrandAceh#2026"}, timeout=30).json()["token"]
H = {"Authorization": f"Bearer {tok}"}

if "--clean" in sys.argv:
    for p in requests.get(f"{BASE}/products", headers=H, timeout=30).json():
        if p["name"].startswith("TEST_XSS"):
            r = requests.delete(f"{BASE}/products/{p['id']}", headers=H, timeout=30)
            print("deleted", p["id"], r.status_code)
    sys.exit(0)

cats = requests.get(f"{BASE}/categories", headers=H, timeout=30).json()
payload = {"name": NAME, "sku": "TEST_XSS_SKU", "price": 10000, "cost": 5000, "category_id": cats[0]["id"], "type": "makanan"}
r = requests.post(f"{BASE}/products", json=payload, headers=H, timeout=30)
print(r.status_code, r.text[:400])
