"""AI feature endpoint tests (iteration 9): description, summary, image, vision invoice."""
import os
import re
import base64
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

AI_TIMEOUT = 120


@pytest.fixture(scope="module")
def creds():
    p = Path("/app/memory/test_credentials.md")
    content = p.read_text(encoding="utf-8")
    m = re.search(r"\|\s*admin\s*\|\s*(\S+)\s*\|\s*(\S+)\s*\|", content)
    if not m:
        pytest.skip("admin creds not found")
    return {"email": m.group(1), "password": m.group(2)}


@pytest.fixture(scope="module")
def client(creds):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code}: {r.text[:300]}")
    tok = r.json().get("token")
    assert tok
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s


# --- AI settings config sanity
def test_ai_settings_configured(client):
    r = client.get(f"{BASE_URL}/api/settings/ai", timeout=30)
    assert r.status_code == 200, r.text[:300]
    feats = r.json()["features"]
    print("AI CONFIG:", {k: {"model": v["model"], "base": v["base_url"], "key": v["api_key_set"]} for k, v in feats.items()})
    for f in ["description", "summary", "vision", "image"]:
        assert feats[f]["api_key_set"] is True, f"{f} api key not set"
        assert feats[f]["model"], f"{f} model empty"


# --- AI product description
def test_ai_product_description(client):
    payload = {"name": "Mie Aceh Goreng Kepiting", "type": "makanan",
               "category": "Makanan", "keywords": "pedas, rempah, kepiting segar"}
    r = client.post(f"{BASE_URL}/api/ai/product-description", json=payload, timeout=AI_TIMEOUT)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:500]}"
    desc = r.json().get("description", "")
    print("DESC:", desc[:300])
    assert isinstance(desc, str) and len(desc.strip()) > 20, f"empty/short description: {desc!r}"


# --- AI report summary
def test_ai_report_summary(client):
    r = client.post(f"{BASE_URL}/api/reports/ai-summary", json={}, timeout=AI_TIMEOUT)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:500]}"
    body = r.json()
    assert "summary" in body and "data" in body
    print("SUMMARY LEN:", len(body["summary"]))
    print("SUMMARY HEAD:", body["summary"][:300])
    assert len(body["summary"].strip()) > 100


# --- AI product image
def test_ai_product_image(client):
    r = client.post(f"{BASE_URL}/api/ai/product-image",
                    json={"name": "Kopi Sanger Aceh", "description": "kopi susu khas Aceh"},
                    timeout=AI_TIMEOUT)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:500]}"
    img = r.json().get("image")
    assert img, "no image returned"
    print("IMAGE PREFIX:", img[:60], "len", len(img))
    assert img.startswith("data:image") or img.startswith("http")


# --- AI vision invoice parse (expectation check: graceful handling allowed)
def test_ai_parse_invoice_graceful(client):
    # 1x1 png
    png = base64.b64encode(bytes.fromhex(
        "89504e470d0a1a0a0000000d494844520000000100000001080200000090"
        "7753de0000000c4944415408d763f8ffff3f0005fe02fea735d2e00000000049454e44ae426082"
    )).decode()
    r = client.post(f"{BASE_URL}/api/ai/parse-invoice",
                    json={"image": f"data:image/png;base64,{png}"}, timeout=AI_TIMEOUT)
    print("PARSE INVOICE STATUS:", r.status_code, r.text[:400])
    assert r.status_code in (200, 400), f"unexpected status {r.status_code}: {r.text[:400]}"
    if r.status_code == 200:
        assert isinstance(r.json().get("items"), list)
    else:
        assert r.json().get("detail")
