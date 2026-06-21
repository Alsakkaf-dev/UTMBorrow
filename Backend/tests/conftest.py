"""Shared fixtures for UTM Borrow backend tests."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
PASSWORD = "Test1234"

USERS = {
    "u1": "alsakkaf@graduate.utm.my",
    "u2": "muaz@graduate.utm.my",
    "u3": "ahmat@graduate.utm.my",
    "admin": "admin@utm.my",
}


def login(email: str, password: str = PASSWORD) -> str:
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed {email}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def tokens():
    return {k: login(v) for k, v in USERS.items()}


@pytest.fixture(scope="session")
def user_ids(tokens):
    ids = {}
    for k, t in tokens.items():
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {t}"}, timeout=30)
        assert r.status_code == 200
        ids[k] = r.json()["user"]["id"]
    return ids


def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def H():
    return auth
