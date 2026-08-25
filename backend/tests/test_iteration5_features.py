"""Iteration 5 — AI settings, per-product min_stock, reports/range trend, margin per product."""
import time
import pytest
import requests
from conftest import API


# ---------------------------------------------------------------- AI SETTINGS
class TestAISettings:
    def test_get_ai_settings_admin(self, admin):
        r = admin.get(f"{API}/settings/ai", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("openai_base_url", "openai_model", "api_key_set"):
            assert k in d, f"missing {k} in {d}"
        assert isinstance(d["api_key_set"], bool)
        assert "openai_api_key" not in d, "SECURITY: raw api key leaked in GET response"

    def test_get_ai_settings_kasir_forbidden(self, kasir):
        r = kasir.get(f"{API}/settings/ai", timeout=30)
        assert r.status_code == 403, f"kasir should be blocked, got {r.status_code}"

    def test_get_ai_settings_anon_unauthorized(self, anon):
        r = anon.get(f"{API}/settings/ai", timeout=30)
        assert r.status_code in (401, 403), r.status_code

    def test_put_ai_settings_kasir_forbidden(self, kasir):
        r = kasir.put(f"{API}/settings/ai", json={"openai_model": "hack"}, timeout=30)
        assert r.status_code == 403, r.status_code

    def test_put_then_get_persistence_and_key_preserved(self, admin):
        original = admin.get(f"{API}/settings/ai", timeout=30).json()
        try:
            # 1. set a key + base url + model
            r = admin.put(f"{API}/settings/ai", json={
                "openai_base_url": "https://TEST.example.com/v1",
                "openai_model": "TEST-model-1",
                "openai_api_key": "sk-TEST-abc123",
            }, timeout=30)
            assert r.status_code == 200, r.text
            g = admin.get(f"{API}/settings/ai", timeout=30).json()
            assert g["openai_base_url"] == "https://TEST.example.com/v1"
            assert g["openai_model"] == "TEST-model-1"
            assert g["api_key_set"] is True

            # 2. update without key -> key must be preserved
            r = admin.put(f"{API}/settings/ai", json={
                "openai_base_url": "https://TEST2.example.com/v1",
                "openai_model": "TEST-model-2",
            }, timeout=30)
            assert r.status_code == 200, r.text
            g = admin.get(f"{API}/settings/ai", timeout=30).json()
            assert g["openai_base_url"] == "https://TEST2.example.com/v1"
            assert g["openai_model"] == "TEST-model-2"
            assert g["api_key_set"] is True, "BUG: blank API key wiped the stored key"

            # 3. empty-string key must also not wipe
            r = admin.put(f"{API}/settings/ai", json={"openai_api_key": ""}, timeout=30)
            assert r.status_code == 200, r.text
            g = admin.get(f"{API}/settings/ai", timeout=30).json()
            assert g["api_key_set"] is True, "BUG: empty-string API key wiped the stored key"
        finally:
            admin.put(f"{API}/settings/ai", json={
                "openai_base_url": original.get("openai_base_url") or "",
                "openai_model": original.get("openai_model") or "",
            }, timeout=30)


# ---------------------------------------------------------------- MIN STOCK
@pytest.fixture(scope="class")
def retail_category(admin):
    cats = admin.get(f"{API}/categories", timeout=30).json()
    retail = [c for c in cats if c["type"] == "retail" and c.get("active")]
    if not retail:
        pytest.fail("No active retail category available for testing")
    return retail[0]


@pytest.fixture(scope="class")
def created_products(admin):
    ids = []
    yield ids
    for pid in ids:
        admin.delete(f"{API}/products/{pid}", timeout=30)


class TestMinStock:
    def test_create_retail_product_with_min_stock(self, admin, retail_category, created_products):
        sku = f"TEST-MS-{int(time.time())}"
        payload = {"name": "TEST_Minstock Produk", "sku": sku, "category_id": retail_category["id"],
                   "type": "retail", "price": 10000, "cost": 6000, "stock": 3, "min_stock": 5}
        r = admin.post(f"{API}/products", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        p = r.json()
        assert "_id" not in p
        assert p["min_stock"] == 5
        assert p["track_stock"] is True
        created_products.append(p["id"])

        got = [x for x in admin.get(f"{API}/products", timeout=30).json() if x["id"] == p["id"]]
        assert got, "created product not returned by GET /products"
        assert got[0]["min_stock"] == 5, "min_stock not persisted"
        assert got[0]["stock"] == 3

    def test_update_min_stock_persists(self, admin, retail_category, created_products):
        pid = created_products[0]
        payload = {"name": "TEST_Minstock Produk", "sku": None, "category_id": retail_category["id"],
                   "type": "retail", "price": 10000, "cost": 6000, "stock": 3, "min_stock": 12}
        cur = [x for x in admin.get(f"{API}/products", timeout=30).json() if x["id"] == pid][0]
        payload["sku"] = cur["sku"]
        r = admin.put(f"{API}/products/{pid}", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["min_stock"] == 12
        got = [x for x in admin.get(f"{API}/products", timeout=30).json() if x["id"] == pid][0]
        assert got["min_stock"] == 12

        # restore to 5 for low-stock test
        payload["min_stock"] = 5
        admin.put(f"{API}/products/{pid}", json=payload, timeout=30)

    def test_low_stock_uses_per_product_threshold(self, admin, created_products):
        pid = created_products[0]
        summary = admin.get(f"{API}/reports/summary", timeout=30).json()
        assert "low_stock" in summary
        low = summary["low_stock"]
        for item in low:
            assert item["stock"] <= item["min_stock"], f"non-low product listed: {item}"
            assert "_id" not in item
        cur = [x for x in admin.get(f"{API}/products", timeout=30).json() if x["id"] == pid][0]
        skus = [i["sku"] for i in low]
        assert cur["sku"] in skus, f"retail product stock=3 min_stock=5 missing from low_stock: {skus}"
        entry = [i for i in low if i["sku"] == cur["sku"]][0]
        assert entry["min_stock"] == 5
        assert entry["stock"] == 3

    def test_high_min_stock_product_flagged(self, admin, retail_category, created_products):
        """Product with stock 50 but min_stock 100 must be flagged (proves not hardcoded 10)."""
        sku = f"TEST-MS2-{int(time.time())}"
        r = admin.post(f"{API}/products", json={
            "name": "TEST_Bigthreshold", "sku": sku, "category_id": retail_category["id"],
            "type": "retail", "price": 5000, "cost": 3000, "stock": 50, "min_stock": 100}, timeout=30)
        assert r.status_code == 200, r.text
        created_products.append(r.json()["id"])
        low = admin.get(f"{API}/reports/summary", timeout=30).json()["low_stock"]
        assert sku in [i["sku"] for i in low], "stock=50/min_stock=100 not flagged as low"

    def test_product_above_threshold_not_flagged(self, admin, retail_category, created_products):
        sku = f"TEST-MS3-{int(time.time())}"
        r = admin.post(f"{API}/products", json={
            "name": "TEST_Safe", "sku": sku, "category_id": retail_category["id"],
            "type": "retail", "price": 5000, "cost": 3000, "stock": 80, "min_stock": 2}, timeout=30)
        assert r.status_code == 200, r.text
        created_products.append(r.json()["id"])
        low = admin.get(f"{API}/reports/summary", timeout=30).json()["low_stock"]
        assert sku not in [i["sku"] for i in low], "safe product wrongly flagged"


# ---------------------------------------------------------------- REPORTS RANGE
class TestReportsRange:
    def test_range_week(self, admin):
        import datetime
        end = (datetime.datetime.utcnow() + datetime.timedelta(hours=7)).date()
        start = end - datetime.timedelta(days=6)
        r = admin.get(f"{API}/reports/range", params={"start": str(start), "end": str(end)}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "daily" in d and isinstance(d["daily"], list)
        for row in d["daily"]:
            assert set(("date", "total", "count")) <= set(row.keys())
        dates = [x["date"] for x in d["daily"]]
        assert dates == sorted(dates), "daily rows not sorted ascending"

    def test_range_month(self, admin):
        import datetime
        end = (datetime.datetime.utcnow() + datetime.timedelta(hours=7)).date()
        start = end - datetime.timedelta(days=29)
        r = admin.get(f"{API}/reports/range", params={"start": str(start), "end": str(end)}, timeout=30)
        assert r.status_code == 200, r.text
        assert isinstance(r.json()["daily"], list)

    def test_range_requires_params(self, admin):
        r = admin.get(f"{API}/reports/range", timeout=30)
        assert r.status_code == 422, r.status_code

    def test_range_kasir_forbidden(self, kasir):
        r = kasir.get(f"{API}/reports/range", params={"start": "2026-07-01", "end": "2026-07-07"}, timeout=30)
        assert r.status_code == 403, r.status_code

    def test_range_invalid_date(self, admin):
        r = admin.get(f"{API}/reports/range", params={"start": "notadate", "end": "2026-07-07"}, timeout=30)
        assert r.status_code in (400, 422), f"expected 4xx for bad date, got {r.status_code}: {r.text[:200]}"


# ---------------------------------------------------------------- MARGIN
class TestMargin:
    def test_summary_top_products_margin_fields(self, admin):
        r = admin.get(f"{API}/reports/summary", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "top_products" in d
        assert "gross_profit" in d and "total_cost" in d
        if not d["top_products"]:
            pytest.skip("No sales today; margin values cannot be validated (structure-only check)")
        for p in d["top_products"]:
            for k in ("name", "qty", "total", "cost", "profit", "margin"):
                assert k in p, f"missing {k} in top_product {p}"
            assert abs(p["profit"] - (p["total"] - p["cost"])) < 0.02, f"profit mismatch {p}"
            expected = round(p["profit"] / p["total"] * 100, 1) if p["total"] else 0
            assert abs(p["margin"] - expected) < 0.11, f"margin mismatch {p} expected {expected}"
        assert len(d["top_products"]) <= 8

    def test_summary_margin_on_historical_date_with_sales(self, admin):
        """Find a date with sales in the last 60 days and validate margin math there."""
        import datetime
        end = (datetime.datetime.utcnow() + datetime.timedelta(hours=7)).date()
        start = end - datetime.timedelta(days=60)
        daily = admin.get(f"{API}/reports/range", params={"start": str(start), "end": str(end)},
                          timeout=30).json()["daily"]
        days = [x for x in daily if x["total"] > 0]
        if not days:
            pytest.skip("No paid orders in last 60 days")
        day = days[-1]["date"]
        d = admin.get(f"{API}/reports/summary", params={"date": day}, timeout=30).json()
        assert d["top_products"], f"no top_products for {day} with total {days[-1]['total']}"
        for p in d["top_products"]:
            expected = round((p["total"] - p["cost"]) / p["total"] * 100, 1) if p["total"] else 0
            assert abs(p["margin"] - expected) < 0.11, f"margin mismatch on {day}: {p}"
        gp = round(d["total_sales"] - d["total_cost"], 2)
        assert abs(d["gross_profit"] - gp) < 0.02
