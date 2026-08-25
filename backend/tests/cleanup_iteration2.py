"""Targeted cleanup for iteration-2 QA data (purchases, opname, cash, TEST_ products).

Run: python /app/backend/tests/cleanup_iteration2.py
Does NOT wipe real orders / demo cash entries.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import dotenv_values

env = dotenv_values("/app/backend/.env")


async def main():
    c = AsyncIOMotorClient(env["MONGO_URL"])
    d = c[env["DB_NAME"]]

    test_prod = {"$or": [{"product_name": {"$regex": "^TEST"}}, {"sku": {"$regex": "^TEST"}},
                         {"note": {"$regex": "^TEST"}}]}
    print("purchases:", (await d.purchases.delete_many(test_prod)).deleted_count)
    print("stock_opname:", (await d.stock_opname.delete_many(test_prod)).deleted_count)
    # QA UI-created purchase / opname on seeded Air Mineral
    print("purchases ui:", (await d.purchases.delete_many({"unit_cost": 7777})).deleted_count)
    print("opname ui:", (await d.stock_opname.delete_many({"counted_stock": 11, "product_name": "Air Mineral 600ml"})).deleted_count)
    print("cash:", (await d.cash_movements.delete_many(
        {"$or": [{"category": {"$regex": "^TEST"}}, {"note": {"$regex": "^TEST"}},
                 {"amount": {"$in": [12345, 777, 5000, 1000, 50000, 20000]}}]})).deleted_count)
    print("products:", (await d.products.delete_many(
        {"$or": [{"name": {"$regex": "^TEST"}}, {"sku": {"$regex": "^TEST"}}]})).deleted_count)
    for sku, stock in [("RT-001", 50), ("RT-002", 30), ("RT-003", 100)]:
        await d.products.update_one({"sku": sku}, {"$set": {"stock": stock, "sold_out": False}})
    print("seeded retail stock restored")
    c.close()


asyncio.run(main())
