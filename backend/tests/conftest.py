import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"


def _creds():
    p = Path("/app/memory/test_credentials.md")
    content = p.read_text(encoding="utf-8")
    emails = re.findall(r'(?im)^\s*[-*]?\s*Email:\s*`?([^`\s]+)', content)
    pws = re.findall(r'(?im)^\s*[-*]?\s*Password:\s*`?([^`\s]+)', content)
    return emails, pws


@pytest.fixture(scope="session")
def admin_creds():
    emails, pws = _creds()
    return {"email": emails[0], "password": pws[0]}


@pytest.fixture(scope="session")
def kasir_creds():
    emails, pws = _creds()
    return {"email": emails[1], "password": pws[1]}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Login failed {r.status_code}: {r.text[:300]}")
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_token(admin_creds):
    return _login(admin_creds)


@pytest.fixture(scope="session")
def kasir_token(kasir_creds):
    return _login(kasir_creds)


@pytest.fixture(scope="session")
def admin(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}"})
    return s


@pytest.fixture(scope="session")
def kasir(kasir_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {kasir_token}"})
    return s


@pytest.fixture(scope="session")
def anon():
    return requests.Session()
