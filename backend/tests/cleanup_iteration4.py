"""Cleanup for iteration-4 verification run.

- soft-deletes TEST_* products / tables / categories via API
- hard-deletes orders created during this test run directly in Mongo
  (no order-delete API exists) + removes today's order counter so the
  sequence restarts cleanly.
"""
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

BASE = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
tok = requests.post(f"{BASE}/auth/login",
                    json={"email": "taqim2609@gmail.com", "password": "GrandAceh#2026"},
                    timeout=30).json()["token"]
H = {"Authorization": f"Bearer {tok}"}

for res, key in [("products", "name"), ("tables", "name"), ("categories", "name")]:
    for it in requests.get(f"{BASE}/{res}", headers=H, timeout=30).json():
        if str(it.get(key, "")).startswith("TEST_"):
            r = requests.delete(f"{BASE}/{res}/{it['id']}", headers=H, timeout=30)
            print("soft-deleted", res, it[key], r.status_code)

env = dotenv_values("/app/backend/.env")
cli = MongoClient(env["MONGO_URL"])
db = cli[env["DB_NAME"]]
res = db.orders.delete_many({"order_number": {"$regex": "^GAK-20260820-"}})
print("orders deleted:", res.deleted_count)
print("counters deleted:", db.counters.delete_many({"_id": {"$regex": "^order-"}}).deleted_count)
# tables left pointing at deleted open bills
print("tables reset:", db.tables.update_many({"status": "open_bill"},
      {"$set": {"status": "empty", "open_order_id": None}}).modified_count)
cli.close()
