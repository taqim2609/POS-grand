"""Cleanup TEST_* artifacts created by iteration-3 (and leftovers from earlier iterations)."""
import requests
from dotenv import dotenv_values

BASE = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
tok = requests.post(f"{BASE}/auth/login", json={"email": "taqim2609@gmail.com", "password": "GrandAceh#2026"}, timeout=30).json()["token"]
H = {"Authorization": f"Bearer {tok}"}

for res, key in [("products", "name"), ("tables", "name"), ("categories", "name")]:
    items = requests.get(f"{BASE}/{res}", headers=H, timeout=30).json()
    for it in items:
        if str(it.get(key, "")).startswith("TEST_"):
            r = requests.delete(f"{BASE}/{res}/{it['id']}", headers=H, timeout=30)
            print(res, it[key], r.status_code)
