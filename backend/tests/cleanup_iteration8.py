"""Cleanup TEST_ categories/products created by iteration 8 pytest run."""
import requests
from dotenv import dotenv_values

API = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
tok = requests.post(f"{API}/auth/login", json={"email": "taqim2609@gmail.com", "password": "GrandAceh#2026"}).json()["token"]
S = requests.Session()
S.headers.update({"Authorization": f"Bearer {tok}"})

for p in S.get(f"{API}/products").json():
    if p["name"].startswith("TEST_"):
        print("del product", p["name"], S.delete(f"{API}/products/{p['id']}").text[:120])
for c in S.get(f"{API}/categories").json():
    if c["name"].startswith("TEST_"):
        print("del category", c["name"], S.delete(f"{API}/categories/{c['id']}").text[:120])
print([c["name"] for c in S.get(f"{API}/categories", params={"include_inactive": False}).json()])
