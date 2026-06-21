"""End-to-end backend tests for UTM Borrow.

Covers: auth, items, transactions, QR scan (success + every failure case),
moderation, ratings/trust, dashboard, notifications, profile.
"""
import os
import time
import uuid
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
PW = "Test1234"


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- 1. Auth ----------
class TestAuth:
    def test_health(self):
        r = requests.get(f"{BASE}/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_login_seeded_users(self, tokens):
        # tokens fixture already validates login for all 4 users
        assert len(tokens) == 4
        for k, v in tokens.items():
            assert isinstance(v, str) and len(v) > 20

    def test_me_with_bearer(self, tokens):
        r = requests.get(f"{BASE}/api/auth/me", headers=H(tokens["u1"]))
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["email"] == "alsakkaf@graduate.utm.my"
        assert "password_hash" not in u

    def test_admin_flag(self, tokens):
        r = requests.get(f"{BASE}/api/auth/me", headers=H(tokens["admin"]))
        assert r.status_code == 200
        assert r.json()["user"]["is_admin"] is True

