"""Tests for iteration-2 features: product cost/HPP, purchases (stock-in),
stock opname, cash movements, gross profit report, WIB bucketing."""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
WIB = timezone(timedelta(hours=7))


def wib_today():
    return datetime.now(timezone.utc).astimezone(WIB).strftime("%Y-%m-%d")


@pytest.fixture(scope="module")
def category_id(admin):
    r = admin.get(f"{API}/categories", timeout=30)
    assert r.status_code == 200, r.text
    cats = r.json()
    assert len(cats) > 0
    return cats[0]["id"]


@pytest.fixture(scope="module")
def created(admin):
    ids = {"products": []}
    yield ids
    for pid in ids["products"]:
        admin.delete(f"{API}/products/{pid}", timeout=30)


def _get_product(admin, pid):
    r = admin.get(f"{API}/products", timeout=30)
    assert r.status_code == 200, r.text
    for p in r.json():
        if p["id"] == pid:
            return p
    raise AssertionError(f"product {pid} not found in list")


def _mk_product(admin, category_id, created, ptype, price, cost, stock=0):
    sfx = uuid.uuid4().hex[:6]
    body = {"name": f"TEST_{ptype}_{sfx}", "sku": f"TEST{sfx}", "category_id": category_id,
            "type": ptype, "price": price, "cost": cost, "stock": stock, "description": "TEST"}
    r = admin.post(f"{API}/products", json=body, timeout=30)
    assert r.status_code in (200, 201), r.text
    p = r.json()
    created["products"].append(p["id"])
    return p


# ------------------------------------------------------------- Product cost
class TestProductCost:
    def test_create_fnb_product_with_cost_persists(self, admin, category_id, created):
        p = _mk_product(admin, category_id, created, "makanan", 25000, 10000)
        assert p["cost"] == 10000
        assert p["track_stock"] is False
        g = _get_product(admin, p["id"])
        assert g["cost"] == 10000
        assert "_id" not in g

    def test_create_retail_product_with_cost(self, admin, category_id, created):
        p = _mk_product(admin, category_id, created, "retail", 15000, 9000, stock=20)
        assert p["cost"] == 9000
        assert p["track_stock"] is True
        assert p["stock"] == 20

    def test_negative_cost_rejected_on_create(self, admin, category_id):
        sfx = uuid.uuid4().hex[:6]
        r = admin.post(f"{API}/products", json={
            "name": f"TEST_neg_{sfx}", "sku": f"TESTN{sfx}", "category_id": category_id,
            "type": "makanan", "price": 1000, "cost": -5}, timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:300]}"

    def test_negative_cost_rejected_on_update(self, admin, category_id, created):
        p = _mk_product(admin, category_id, created, "minuman", 8000, 3000)
        r = admin.put(f"{API}/products/{p['id']}", json={
            "name": p["name"], "sku": p["sku"], "category_id": category_id,
            "type": "minuman", "price": 8000, "cost": -1}, timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:300]}"

    def test_update_cost_persists(self, admin, category_id, created):
        p = _mk_product(admin, category_id, created, "minuman", 8000, 3000)
        r = admin.put(f"{API}/products/{p['id']}", json={
            "name": p["name"], "sku": p["sku"], "category_id": category_id,
            "type": "minuman", "price": 9000, "cost": 4500}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["cost"] == 4500
        g = _get_product(admin, p["id"])
        assert g["cost"] == 4500 and g["price"] == 9000

    def test_products_list_returns_cost(self, admin):
        r = admin.get(f"{API}/products", timeout=30)
        assert r.status_code == 200, r.text
        items = r.json()
        assert len(items) > 0
        assert all("cost" in p for p in items), "cost missing in products list"
        assert all("_id" not in p for p in items)


# ------------------------------------------------------------- Purchases
class TestPurchases:
    def test_purchase_increases_stock_and_sets_cost(self, admin, category_id, created):
        p = _mk_product(admin, category_id, created, "retail", 20000, 12000, stock=5)
        r = admin.post(f"{API}/purchases", json={"product_id": p["id"], "qty": 10,
                                                 "unit_cost": 13500, "note": "TEST_purchase"}, timeout=30)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        assert d["new_stock"] == 15, d
        assert d["total_cost"] == 135000
        assert d["qty"] == 10 and d["unit_cost"] == 13500
        assert "_id" not in d
        g = _get_product(admin, p["id"])
        assert g["stock"] == 15, f"stock not incremented: {g['stock']}"
        assert g["cost"] == 13500, f"cost not updated: {g['cost']}"

    def test_purchase_rejected_for_non_retail(self, admin, category_id, created):
        p = _mk_product(admin, category_id, created, "makanan", 20000, 8000)
        r = admin.post(f"{API}/purchases", json={"product_id": p["id"], "qty": 5, "unit_cost": 1000}, timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:300]}"

    def test_purchase_invalid_qty_rejected(self, admin, category_id, created):
        p = _mk_product(admin, category_id, created, "retail", 20000, 12000, stock=5)
        r = admin.post(f"{API}/purchases", json={"product_id": p["id"], "qty": 0, "unit_cost": 1000}, timeout=30)
        assert r.status_code == 422, r.status_code
        r2 = admin.post(f"{API}/purchases", json={"product_id": p["id"], "qty": 2, "unit_cost": -3}, timeout=30)
        assert r2.status_code == 422, r2.status_code

    def test_purchase_unknown_product_404(self, admin):
        r = admin.post(f"{API}/purchases", json={"product_id": "nope-" + uuid.uuid4().hex,
                                                 "qty": 1, "unit_cost": 100}, timeout=30)
        assert r.status_code == 404, r.status_code

    def test_purchase_list_today(self, admin, category_id, created):
        p = _mk_product(admin, category_id, created, "retail", 20000, 12000, stock=0)
        admin.post(f"{API}/purchases", json={"product_id": p["id"], "qty": 3, "unit_cost": 500}, timeout=30)
        r = admin.get(f"{API}/purchases", params={"date": wib_today()}, timeout=30)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert any(x["product_id"] == p["id"] and x["qty"] == 3 for x in rows), "purchase not in today's list"
        assert all("_id" not in x for x in rows)

    def test_purchase_kasir_forbidden(self, kasir, category_id, admin, created):
        p = _mk_product(admin, category_id, created, "retail", 20000, 12000, stock=1)
        r = kasir.post(f"{API}/purchases", json={"product_id": p["id"], "qty": 1, "unit_cost": 100}, timeout=30)
        assert r.status_code in (401, 403), r.status_code

    def test_purchase_requires_auth(self, anon, category_id):
        r = anon.post(f"{API}/purchases", json={"product_id": "x", "qty": 1, "unit_cost": 1}, timeout=30)
        assert r.status_code in (401, 403), r.status_code


# ------------------------------------------------------------- Stock opname
class TestStockOpname:
    def test_opname_sets_stock_and_records_diff(self, admin, category_id, created):
        p = _mk_product(admin, category_id, created, "retail", 20000, 12000, stock=20)
        r = admin.post(f"{API}/stock-opname", json={"product_id": p["id"], "counted_stock": 17,
                                                    "note": "TEST_opname"}, timeout=30)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        assert d["system_stock"] == 20 and d["counted_stock"] == 17 and d["difference"] == -3, d
        g = _get_product(admin, p["id"])
        assert g["stock"] == 17, f"stock not set: {g['stock']}"

    def test_opname_positive_diff(self, admin, category_id, created):
        p = _mk_product(admin, category_id, created, "retail", 20000, 12000, stock=5)
        d = admin.post(f"{API}/stock-opname", json={"product_id": p["id"], "counted_stock": 9}, timeout=30).json()
        assert d["difference"] == 4
        assert _get_product(admin, p["id"])["stock"] == 9

    def test_opname_rejected_for_non_retail(self, admin, category_id, created):
        p = _mk_product(admin, category_id, created, "minuman", 5000, 2000)
        r = admin.post(f"{API}/stock-opname", json={"product_id": p["id"], "counted_stock": 3}, timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:300]}"

    def test_opname_negative_count_rejected(self, admin, category_id, created):
        p = _mk_product(admin, category_id, created, "retail", 20000, 12000, stock=5)
        r = admin.post(f"{API}/stock-opname", json={"product_id": p["id"], "counted_stock": -1}, timeout=30)
        assert r.status_code == 422, r.status_code

    def test_opname_list_today(self, admin, category_id, created):
        p = _mk_product(admin, category_id, created, "retail", 20000, 12000, stock=8)
        admin.post(f"{API}/stock-opname", json={"product_id": p["id"], "counted_stock": 8}, timeout=30)
        r = admin.get(f"{API}/stock-opname", params={"date": wib_today()}, timeout=30)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert any(x["product_id"] == p["id"] for x in rows)
        assert all("_id" not in x for x in rows)

    def test_opname_kasir_forbidden(self, kasir):
        r = kasir.post(f"{API}/stock-opname", json={"product_id": "x", "counted_stock": 1}, timeout=30)
        assert r.status_code in (401, 403), r.status_code


# ------------------------------------------------------------- Cash movements
class TestCashMovements:
    def test_cash_in_and_out_totals(self, admin):
        before = admin.get(f"{API}/cash", params={"date": wib_today()}, timeout=30)
        assert before.status_code == 200, before.text
        b = before.json()
        r1 = admin.post(f"{API}/cash", json={"type": "in", "amount": 50000,
                                             "category": "TEST_Modal", "note": "TEST"}, timeout=30)
        assert r1.status_code in (200, 201), r1.text
        m1 = r1.json()
        assert m1["type"] == "in" and m1["amount"] == 50000 and m1["category"] == "TEST_Modal"
        assert "_id" not in m1
        r2 = admin.post(f"{API}/cash", json={"type": "out", "amount": 20000,
                                             "category": "TEST_Belanja"}, timeout=30)
        assert r2.status_code in (200, 201), r2.text
        after = admin.get(f"{API}/cash", params={"date": wib_today()}, timeout=30).json()
        assert after["cash_in"] == pytest.approx(b["cash_in"] + 50000)
        assert after["cash_out"] == pytest.approx(b["cash_out"] + 20000)
        assert after["cash_net"] == pytest.approx(after["cash_in"] - after["cash_out"])
        ids = [m["id"] for m in after["movements"]]
        assert m1["id"] in ids

    def test_cash_invalid_amount_rejected(self, admin):
        for amt in (0, -100):
            r = admin.post(f"{API}/cash", json={"type": "in", "amount": amt}, timeout=30)
            assert r.status_code == 422, f"amount={amt} -> {r.status_code}"

    def test_cash_invalid_type_rejected(self, admin):
        r = admin.post(f"{API}/cash", json={"type": "sideways", "amount": 100}, timeout=30)
        assert r.status_code == 422, r.status_code

    def test_cash_kasir_allowed(self, kasir):
        r = kasir.post(f"{API}/cash", json={"type": "out", "amount": 1000, "category": "TEST_Kasir"}, timeout=30)
        assert r.status_code in (200, 201), r.text
        assert r.json()["cashier_name"]
        g = kasir.get(f"{API}/cash", timeout=30)
        assert g.status_code == 200, g.text
        assert "movements" in g.json() and "cash_net" in g.json()

    def test_cash_requires_auth(self, anon):
        assert anon.get(f"{API}/cash", timeout=30).status_code in (401, 403)
        assert anon.post(f"{API}/cash", json={"type": "in", "amount": 1}, timeout=30).status_code in (401, 403)

    def test_cash_other_day_empty_or_scoped(self, admin):
        r = admin.get(f"{API}/cash", params={"date": "2001-01-01"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["date"] == "2001-01-01"
        assert d["movements"] == [] and d["cash_in"] == 0 and d["cash_net"] == 0


# ------------------------------------------------------------- Gross profit
class TestGrossProfitReport:
    def test_summary_has_new_fields(self, admin):
        r = admin.get(f"{API}/reports/summary", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total_cost", "gross_profit", "cash_in", "cash_out", "cash_net", "total_sales"):
            assert k in d, f"missing {k}"
        assert d["gross_profit"] == pytest.approx(round(d["total_sales"] - d["total_cost"], 2))
        assert d["cash_net"] == pytest.approx(round(d["cash_in"] - d["cash_out"], 2))
        assert d["date"] == wib_today()

    def test_paid_order_contributes_cost_and_profit(self, admin, category_id, created):
        p = _mk_product(admin, category_id, created, "retail", 30000, 18000, stock=50)
        before = admin.get(f"{API}/reports/summary", timeout=30).json()
        pms = admin.get(f"{API}/payment-methods", timeout=30)
        assert pms.status_code == 200, pms.text
        pm = pms.json()[0]
        o = admin.post(f"{API}/orders", json={"order_type": "retail",
                                              "items": [{"product_id": p["id"], "qty": 2}]}, timeout=30)
        assert o.status_code in (200, 201), o.text
        order = o.json()
        assert order["items"][0]["cost"] == 18000, f"cost not snapshotted on order item: {order['items'][0]}"
        pay = admin.post(f"{API}/orders/{order['id']}/pay",
                         json={"payment_method": pm["id"], "amount_paid": order["total"]}, timeout=30)
        assert pay.status_code == 200, pay.text
        after = admin.get(f"{API}/reports/summary", timeout=30).json()
        assert after["total_cost"] == pytest.approx(before["total_cost"] + 36000), \
            f"total_cost {before['total_cost']} -> {after['total_cost']}"
        assert after["total_sales"] == pytest.approx(before["total_sales"] + order["total"])
        assert after["gross_profit"] == pytest.approx(round(after["total_sales"] - after["total_cost"], 2))
        stock = _get_product(admin, p["id"])["stock"]
        assert stock == 48, f"stock not decremented on pay: {stock}"

    def test_summary_kasir_forbidden(self, kasir):
        r = kasir.get(f"{API}/reports/summary", timeout=30)
        assert r.status_code in (401, 403), r.status_code


# ------------------------------------------------------------- WIB bucketing
class TestWIBTimezone:
    def test_endpoints_use_wib_today(self, admin):
        wt = wib_today()
        utc_today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        s = admin.get(f"{API}/reports/summary", timeout=30).json()
        c = admin.get(f"{API}/cash", timeout=30).json()
        assert s["date"] == wt and c["date"] == wt
        if wt != utc_today:
            assert s["date"] != utc_today  # explicit WIB rollover check

    def test_cash_created_today_is_in_wib_bucket(self, admin):
        r = admin.post(f"{API}/cash", json={"type": "in", "amount": 777, "category": "TEST_WIB"}, timeout=30)
        assert r.status_code in (200, 201), r.text
        mid = r.json()["id"]
        today = admin.get(f"{API}/cash", params={"date": wib_today()}, timeout=30).json()
        assert mid in [m["id"] for m in today["movements"]], "movement not bucketed in WIB today"
        yesterday = (datetime.now(timezone.utc).astimezone(WIB) - timedelta(days=1)).strftime("%Y-%m-%d")
        y = admin.get(f"{API}/cash", params={"date": yesterday}, timeout=30).json()
        assert mid not in [m["id"] for m in y["movements"]]

    def test_orders_date_filter_wib(self, admin):
        r = admin.get(f"{API}/orders", params={"date": wib_today()}, timeout=30)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)


# ------------------------------------------------------- Edge: update retail product
class TestRetailProductUpdateStock:
    def test_update_without_stock_field_resets_stock(self, admin, category_id, created):
        """Editing a retail product without sending `stock` should not wipe existing stock."""
        p = _mk_product(admin, category_id, created, "retail", 20000, 12000, stock=25)
        r = admin.put(f"{API}/products/{p['id']}", json={
            "name": p["name"], "sku": p["sku"], "category_id": category_id,
            "type": "retail", "price": 21000, "cost": 12000}, timeout=30)
        assert r.status_code == 200, r.text
        g = _get_product(admin, p["id"])
        assert g["stock"] == 25, f"stock wiped by update (was 25, now {g['stock']})"
