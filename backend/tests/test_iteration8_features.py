"""Iteration 8: category report, AI vision (parse-invoice), shift gate API, barcode SKU data."""
import base64
import os
import time

import pytest
import requests

from conftest import API

STAMP = str(int(time.time()))[-6:] + os.environ.get("PYTEST_XDIST_WORKER", "s0")


# ---------------------------------------------------------------- seed data
@pytest.fixture(scope="module")
def seed(admin):
    created = {"categories": [], "products": [], "orders": []}

    def mkcat(name, ctype):
        r = admin.post(f"{API}/categories", json={"name": name, "type": ctype, "sort_order": 1}, timeout=30)
        assert r.status_code in (200, 201), f"category create failed {r.status_code} {r.text[:300]}"
        d = r.json()
        assert d["name"] == name and d["type"] == ctype
        created["categories"].append(d["id"])
        return d

    def mkprod(name, cat, price, cost, sku=None, stock=0):
        body = {"name": name, "sku": sku, "category_id": cat["id"], "type": cat["type"],
                "price": price, "cost": cost, "stock": stock, "min_stock": 1}
        r = admin.post(f"{API}/products", json=body, timeout=30)
        assert r.status_code in (200, 201), f"product create failed {r.status_code} {r.text[:300]}"
        d = r.json()
        assert d["name"] == name and d["price"] == price
        created["products"].append(d["id"])
        return d

    cat_m = mkcat(f"TEST_Makanan_{STAMP}", "makanan")
    cat_d = mkcat(f"TEST_Minuman_{STAMP}", "minuman")
    cat_r = mkcat(f"TEST_Retail_{STAMP}", "retail")
    p_m = mkprod(f"TEST_Mie_{STAMP}", cat_m, 25000, 10000, sku=f"TESTMIE{STAMP}")
    p_d = mkprod(f"TEST_Teh_{STAMP}", cat_d, 8000, 2000, sku=f"TESTTEH{STAMP}")
    p_r = mkprod(f"TEST_Rokok_{STAMP}", cat_r, 30000, 25000, sku=f"TESTSKU{STAMP}", stock=50)

    data = {"cat_m": cat_m, "cat_d": cat_d, "cat_r": cat_r,
            "p_m": p_m, "p_d": p_d, "p_r": p_r, "created": created}
    yield data

    for oid in created["orders"]:
        admin.post(f"{API}/orders/{oid}/void", json={"action": "void", "reason": "TEST cleanup"}, timeout=30)
    for pid in created["products"]:
        admin.delete(f"{API}/products/{pid}", timeout=30)
    for cid in created["categories"]:
        admin.delete(f"{API}/categories/{cid}", timeout=30)


@pytest.fixture(scope="module")
def cash_pm(admin):
    r = admin.get(f"{API}/payment-methods", timeout=30)
    assert r.status_code == 200
    cash = [p for p in r.json() if p.get("type") == "cash" and p.get("active")]
    assert cash, "no active cash payment method"
    return cash[0]


# ---------------------------------------------------------------- shifts
class TestShiftGate:
    def test_current_shift_endpoint(self, admin):
        r = admin.get(f"{API}/shifts/current", timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body is None or ("id" in body and body["status"] == "open")

    def test_open_shift_idempotency(self, admin):
        cur = admin.get(f"{API}/shifts/current", timeout=30).json()
        if not cur:
            r = admin.post(f"{API}/shifts/open", json={"opening_cash": 100000}, timeout=30)
            assert r.status_code == 200, r.text[:300]
            assert r.json()["opening_cash"] == 100000
            assert r.json()["status"] == "open"
        # second open must fail
        r2 = admin.post(f"{API}/shifts/open", json={"opening_cash": 1}, timeout=30)
        assert r2.status_code == 400
        assert "shift" in r2.json()["detail"].lower()
        # current shift is now non-null (gate should pass in UI)
        assert admin.get(f"{API}/shifts/current", timeout=30).json() is not None


# ---------------------------------------------------------------- orders + category report
class TestCategoryReport:
    def test_paid_orders_and_category_report(self, admin, seed, cash_pm):
        # ensure a shift is open for the admin (orders attach to shift)
        if not admin.get(f"{API}/shifts/current", timeout=30).json():
            admin.post(f"{API}/shifts/open", json={"opening_cash": 100000}, timeout=30)

        before = admin.get(f"{API}/reports/summary", timeout=30)
        assert before.status_code == 200
        cr0 = before.json()["category_report"]
        base_mak = cr0["makanan"]["total"]
        base_min = cr0["minuman"]["total"]
        base_ret = cr0["retail"]["total"]

        # F&B order: 2x makanan + 1x minuman
        r = admin.post(f"{API}/orders", json={
            "order_type": "take_away", "table_id": None,
            "items": [{"product_id": seed["p_m"]["id"], "qty": 2},
                      {"product_id": seed["p_d"]["id"], "qty": 1}],
            "discount_type": "none", "discount_value": 0}, timeout=30)
        assert r.status_code in (200, 201), r.text[:300]
        o1 = r.json()
        seed["created"]["orders"].append(o1["id"])
        assert o1["subtotal"] == 2 * 25000 + 8000
        pay = admin.post(f"{API}/orders/{o1['id']}/pay", json={
            "payment_method": cash_pm["id"], "discount_type": "none",
            "discount_value": 0, "amount_paid": 100000}, timeout=30)
        assert pay.status_code == 200, pay.text[:300]
        assert pay.json()["status"] == "paid"

        # retail order: 1x retail
        r = admin.post(f"{API}/orders", json={
            "order_type": "retail", "table_id": None,
            "items": [{"product_id": seed["p_r"]["id"], "qty": 1}],
            "discount_type": "none", "discount_value": 0}, timeout=30)
        assert r.status_code in (200, 201), r.text[:300]
        o2 = r.json()
        seed["created"]["orders"].append(o2["id"])
        pay2 = admin.post(f"{API}/orders/{o2['id']}/pay", json={
            "payment_method": cash_pm["id"], "discount_type": "none",
            "discount_value": 0, "amount_paid": 30000}, timeout=30)
        assert pay2.status_code == 200, pay2.text[:300]

        after = admin.get(f"{API}/reports/summary", timeout=30)
        assert after.status_code == 200
        cr = after.json()["category_report"]
        assert cr["makanan"]["total"] == base_mak + 50000
        assert cr["minuman"]["total"] == base_min + 8000
        assert cr["retail"]["total"] == base_ret + 30000

        mak_rows = {c["name"]: c for c in cr["makanan"]["categories"]}
        min_rows = {c["name"]: c for c in cr["minuman"]["categories"]}
        assert seed["cat_m"]["name"] in mak_rows
        assert mak_rows[seed["cat_m"]["name"]]["total"] >= 50000
        assert mak_rows[seed["cat_m"]["name"]]["qty"] >= 2
        assert seed["cat_d"]["name"] in min_rows
        assert min_rows[seed["cat_d"]["name"]]["total"] >= 8000
        # no cross-contamination of types
        assert all(c["type"] == "makanan" for c in cr["makanan"]["categories"])
        assert all(c["type"] == "minuman" for c in cr["minuman"]["categories"])

    def test_summary_has_no_mongo_id(self, admin):
        body = admin.get(f"{API}/reports/summary", timeout=30).json()

        def walk(node):
            if isinstance(node, dict):
                assert "_id" not in node, f"mongo _id leaked: {list(node)}"
                for v in node.values():
                    walk(v)
            elif isinstance(node, list):
                for v in node:
                    walk(v)

        walk(body)

    def test_summary_forbidden_for_kasir(self, kasir):
        r = kasir.get(f"{API}/reports/summary", timeout=30)
        assert r.status_code == 403


# ---------------------------------------------------------------- barcode/SKU support
class TestBarcodeData:
    def test_retail_product_exposes_sku(self, admin, seed):
        r = admin.get(f"{API}/products", params={"active_only": True}, timeout=30)
        assert r.status_code == 200
        prods = {p["id"]: p for p in r.json()}
        assert seed["p_r"]["id"] in prods
        p = prods[seed["p_r"]["id"]]
        assert p["sku"] == f"TESTSKU{STAMP}"
        assert p["type"] == "retail"
        assert p["stock"] > 0


# ---------------------------------------------------------------- AI settings + vision
class TestAIVision:
    def test_ai_settings_lists_vision_feature(self, admin):
        r = admin.get(f"{API}/settings/ai", timeout=30)
        assert r.status_code == 200
        feats = r.json()
        assert "features" in feats
        keys = set(feats["features"].keys())
        assert {"description", "image", "summary", "vision"} <= keys, keys

    def test_parse_invoice_handles_failure_gracefully(self, admin):
        img = base64.b64encode(
            base64.b64decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AGVgHkYAAAAAElFTkSuQmCC"
            )
        ).decode()
        r = admin.post(f"{API}/ai/parse-invoice", json={"image": img}, timeout=120)
        assert r.status_code in (200, 400, 502), f"unexpected {r.status_code}: {r.text[:300]}"
        if r.status_code == 200:
            assert isinstance(r.json()["items"], list)
        else:
            ct = r.headers.get("content-type", "")
            # NOTE: through the public ingress a 502 body is replaced by a Cloudflare HTML page,
            # so the backend error detail never reaches the browser.
            assert "json" in ct, f"non-JSON error body via public URL ({r.status_code}, {ct})"
            assert isinstance(r.json()["detail"], str) and r.json()["detail"]

    def test_parse_invoice_requires_admin(self, kasir, anon):
        r = kasir.post(f"{API}/ai/parse-invoice", json={"image": "x"}, timeout=60)
        assert r.status_code == 403
        r2 = anon.post(f"{API}/ai/parse-invoice", json={"image": "x"}, timeout=60)
        assert r2.status_code in (401, 403)

    def test_parse_invoice_validation(self, admin):
        r = admin.post(f"{API}/ai/parse-invoice", json={}, timeout=30)
        assert r.status_code == 422
