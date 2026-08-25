"""Purge data created by the QA suite (TEST_* entities + test-generated orders/logs).

Run AFTER the full pytest/playwright run:
    python /app/backend/tests/cleanup_test_data.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import dotenv_values

env = dotenv_values("/app/backend/.env")


async def main():
    c = AsyncIOMotorClient(env["MONGO_URL"])
    d = c[env["DB_NAME"]]
    jobs = [
        ("products", d.products, {"$or": [{"name": {"$regex": "^TEST"}}, {"sku": {"$regex": "^TEST"}}]}),
        ("categories", d.categories, {"name": {"$regex": "^TEST"}}),
        ("tables", d.tables, {"name": {"$regex": "^TEST"}}),
        ("users", d.users, {"email": {"$regex": r"^test_.*@example\.com$"}}),
        ("orders", d.orders, {}),
        ("audit_logs", d.audit_logs, {}),
        ("shifts", d.shifts, {}),
        ("import_logs", d.import_logs, {}),
    ]
    for name, coll, q in jobs:
        r = await coll.delete_many(q)
        print(f"{name}: deleted {r.deleted_count}")
    # restore seeded retail stock levels touched by test sales
    for sku, stock in [("RT-001", 50), ("RT-002", 30), ("RT-003", 100)]:
        await d.products.update_one({"sku": sku}, {"$set": {"stock": stock, "sold_out": False}})
    print("seed retail stock restored")
    c.close()


asyncio.run(main())
