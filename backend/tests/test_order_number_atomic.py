"""Iteration-4 verification: atomic order-number generation (BUG FIX HIGH).

Covers:
- unique index on orders.order_number
- sequential creation -> unique, monotonic GAK-YYYYMMDD-#### numbers
- concurrent creation (threads) -> no duplicates
- global duplicate scan across all existing orders
"""
import re
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

import pytest
import requests

from conftest import API

ORDER_RE = re.compile(r"^GAK-\d{8}-\d{4}$")


@pytest.fixture(scope="module")
def food_product(admin):
    r = admin.get(f"{API}/products", timeout=30)
    assert r.status_code == 200, r.text
    prods = [p for p in r.json() if p.get("active", True) and not p.get("sold_out")
             and not str(p.get("name", "")).startswith("TEST_")
             and p.get("type") != "retail"]
    if not prods:
        pytest.fail("No active non-retail product available to build test orders")
    return prods[0]


def _payload(product):
    return {
        "order_type": "take_away",
        "items": [{"product_id": product["id"], "name": product["name"],
                   "price": product["price"], "qty": 1, "type": product.get("type", "food")}],
        "note": "TEST_IT4_atomic",
    }


class TestOrderNumberAtomicity:
    created = []

    def test_unique_index_exists(self, admin, food_product):
        """Indirect proof: two orders can never share a number; direct index check via pymongo."""
        from pymongo import MongoClient
        from dotenv import dotenv_values
        env = dotenv_values("/app/backend/.env")
        cli = MongoClient(env["MONGO_URL"])
        idx = cli[env["DB_NAME"]].orders.index_information()
        has_unique = any(
            v.get("unique") and v["key"][0][0] == "order_number" for v in idx.values()
        )
        cli.close()
        assert has_unique, f"No unique index on orders.order_number. Indexes: {idx}"

    def test_sequential_orders_unique_and_monotonic(self, kasir, food_product):
        nums = []
        for _ in range(5):
            r = kasir.post(f"{API}/orders", json=_payload(food_product), timeout=30)
            assert r.status_code == 200, r.text
            d = r.json()
            assert ORDER_RE.match(d["order_number"]), d["order_number"]
            assert "_id" not in d
            nums.append(d["order_number"])
            type(self).created.append(d["id"])
        assert len(set(nums)) == 5, f"duplicate order numbers: {nums}"
        seqs = [int(n.split("-")[-1]) for n in nums]
        assert seqs == sorted(seqs), f"not monotonic: {seqs}"
        assert seqs[-1] - seqs[0] == 4, f"gaps in sequence: {seqs}"

    def test_concurrent_orders_no_duplicates(self, kasir_token, food_product):
        def mk(_):
            s = requests.Session()
            s.headers.update({"Authorization": f"Bearer {kasir_token}"})
            return s.post(f"{API}/orders", json=_payload(food_product), timeout=60)

        with ThreadPoolExecutor(max_workers=10) as ex:
            responses = list(ex.map(mk, range(10)))

        oks = [r for r in responses if r.status_code == 200]
        assert len(oks) == 10, [(r.status_code, r.text[:150]) for r in responses if r.status_code != 200]
        nums = []
        for r in oks:
            d = r.json()
            assert ORDER_RE.match(d["order_number"]), d["order_number"]
            nums.append(d["order_number"])
            type(self).created.append(d["id"])
        dups = [n for n, c in Counter(nums).items() if c > 1]
        assert not dups, f"duplicate order numbers under concurrency: {dups}"

    def test_no_duplicates_in_whole_collection(self, admin):
        from pymongo import MongoClient
        from dotenv import dotenv_values
        env = dotenv_values("/app/backend/.env")
        cli = MongoClient(env["MONGO_URL"])
        rows = list(cli[env["DB_NAME"]].orders.aggregate([
            {"$group": {"_id": "$order_number", "c": {"$sum": 1}}},
            {"$match": {"c": {"$gt": 1}}},
        ]))
        cli.close()
        assert not rows, f"duplicate order_numbers in DB: {rows}"

    def test_created_orders_are_persisted_and_retrievable(self, kasir):
        assert type(self).created, "no orders created by previous tests"
        oid = type(self).created[0]
        r = kasir.get(f"{API}/orders/{oid}", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"] == oid
        assert ORDER_RE.match(d["order_number"])
        assert d["status"] == "open"
