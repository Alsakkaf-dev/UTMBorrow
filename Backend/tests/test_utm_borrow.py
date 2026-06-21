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

    def test_register_non_utm_rejected(self):
        r = requests.post(f"{BASE}/api/auth/register", json={
            "full_name": "Bad", "matric_no": f"X{uuid.uuid4().hex[:6]}",
            "email": f"bad{uuid.uuid4().hex[:6]}@gmail.com", "password": PW})
        assert r.status_code == 400
        assert "UTM" in r.json()["detail"]

    def test_register_valid_utm_succeeds_and_duplicate_rejected(self):
        suffix = uuid.uuid4().hex[:8]
        email = f"test_{suffix}@graduate.utm.my"
        matric = f"TEST{suffix.upper()}"
        body = {"full_name": "Test User", "matric_no": matric, "email": email, "password": PW}
        r = requests.post(f"{BASE}/api/auth/register", json=body)
        assert r.status_code == 200, r.text
        assert "token" in r.json()
        # duplicate email
        r2 = requests.post(f"{BASE}/api/auth/register", json={**body, "matric_no": f"OTHER{suffix}"})
        assert r2.status_code == 400
        # duplicate matric
        r3 = requests.post(f"{BASE}/api/auth/register",
                           json={**body, "email": f"other_{suffix}@graduate.utm.my"})
        assert r3.status_code == 400

    def test_invalid_password(self):
        r = requests.post(f"{BASE}/api/auth/login",
                          json={"email": "alsakkaf@graduate.utm.my", "password": "wrong"})
        assert r.status_code == 401

    def test_forgot_and_reset_password(self):
        # register a throwaway user
        suffix = uuid.uuid4().hex[:8]
        email = f"reset_{suffix}@utm.my"
        requests.post(f"{BASE}/api/auth/register", json={
            "full_name": "Reset User", "matric_no": f"RST{suffix.upper()}",
            "email": email, "password": PW})
        fr = requests.post(f"{BASE}/api/auth/forgot-password", json={"email": email})
        assert fr.status_code == 200
        tok = fr.json().get("recovery_token")
        assert tok
        rr = requests.post(f"{BASE}/api/auth/reset-password",
                           json={"token": tok, "new_password": "NewPass1234"})
        assert rr.status_code == 200
        # new pw works
        r = requests.post(f"{BASE}/api/auth/login",
                          json={"email": email, "password": "NewPass1234"})
        assert r.status_code == 200


