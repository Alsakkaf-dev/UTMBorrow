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


# ---------- 2. Catalog ----------
class TestCatalog:
    def test_meta(self):
        r = requests.get(f"{BASE}/api/items/meta")
        assert r.status_code == 200
        data = r.json()
        for k in ("categories", "conditions", "colleges", "faculties"):
            assert k in data and len(data[k]) > 0

    def test_browse_only_available(self):
        r = requests.get(f"{BASE}/api/items")
        assert r.status_code == 200
        items = r.json()["items"]
        assert all(i["availability_status"] == "Available" for i in items)
        # seeded ~5 Available (3 are Pending/Pending/Borrowed; 1 unrelated)
        assert len(items) >= 4

    def test_browse_filters(self):
        r = requests.get(f"{BASE}/api/items", params={"category": "Electronics"})
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it["category"] == "Electronics"
        r2 = requests.get(f"{BASE}/api/items", params={"q": "lab"})
        assert r2.status_code == 200

    def test_create_edit_delete(self, tokens, user_ids):
        payload = {"title": "TEST_Item", "description": "test", "category": "Other",
                   "condition": "Good", "location_college": "KTF", "location_faculty": "FC"}
        r = requests.post(f"{BASE}/api/items", json=payload, headers=H(tokens["u1"]))
        assert r.status_code == 200, r.text
        item = r.json()["item"]
        assert item["availability_status"] == "Available"
        assert item["owner_id"] == user_ids["u1"]
        item_id = item["id"]

        # GET to verify
        g = requests.get(f"{BASE}/api/items/{item_id}")
        assert g.status_code == 200
        assert g.json()["item"]["title"] == "TEST_Item"

        # Edit
        upd = {**payload, "title": "TEST_Item_Updated"}
        r = requests.put(f"{BASE}/api/items/{item_id}", json=upd, headers=H(tokens["u1"]))
        assert r.status_code == 200
        assert r.json()["item"]["title"] == "TEST_Item_Updated"

        # mine
        r = requests.get(f"{BASE}/api/items/mine", headers=H(tokens["u1"]))
        assert r.status_code == 200
        assert any(i["id"] == item_id for i in r.json()["items"])

        # Delete own item
        r = requests.delete(f"{BASE}/api/items/{item_id}", headers=H(tokens["u1"]))
        assert r.status_code == 200
        # 404 after delete
        g2 = requests.get(f"{BASE}/api/items/{item_id}")
        assert g2.status_code == 404

    def test_edit_blocked_when_pending(self, tokens):
        # Seeded "Scientific Calculator" is in Pending; find it via /mine of u1
        r = requests.get(f"{BASE}/api/items/mine", headers=H(tokens["u1"]))
        pending_items = [i for i in r.json()["items"] if i["availability_status"] == "Pending"]
        assert pending_items
        it = pending_items[0]
        payload = {"title": it["title"], "description": it.get("description") or "x",
                   "category": it["category"], "condition": it["condition"],
                   "location_college": it["location_college"],
                   "location_faculty": it.get("location_faculty")}
        r = requests.put(f"{BASE}/api/items/{it['id']}", json=payload, headers=H(tokens["u1"]))
        assert r.status_code == 400

    def test_delete_blocked_when_pending(self, tokens):
        r = requests.get(f"{BASE}/api/items/mine", headers=H(tokens["u1"]))
        pending_items = [i for i in r.json()["items"] if i["availability_status"] == "Pending"]
        assert pending_items
        r2 = requests.delete(f"{BASE}/api/items/{pending_items[0]['id']}", headers=H(tokens["u1"]))
        assert r2.status_code == 400

    def test_delete_blocked_when_borrowed(self, tokens):
        # Seeded Arduino Kit owned by u3 is Borrowed
        r = requests.get(f"{BASE}/api/items/mine", headers=H(tokens["u3"]))
        borrowed = [i for i in r.json()["items"] if i["availability_status"] == "Borrowed"]
        assert borrowed
        r2 = requests.delete(f"{BASE}/api/items/{borrowed[0]['id']}", headers=H(tokens["u3"]))
        assert r2.status_code == 400


# ---------- 3. Transactions ----------
@pytest.fixture(scope="module")
def fresh_tx(tokens, user_ids):
    """u1 creates a fresh item; u2 borrows it (idempotent across runs)."""
    payload = {"title": f"TEST_TX_{uuid.uuid4().hex[:6]}", "category": "Other",
               "condition": "Good", "location_college": "KTF"}
    rc = requests.post(f"{BASE}/api/items", json=payload, headers=H(tokens["u1"]))
    assert rc.status_code == 200, rc.text
    target = rc.json()["item"]
    from datetime import date, timedelta
    body = {"item_id": target["id"],
            "borrow_start_date": date.today().isoformat(),
            "borrow_end_date": (date.today() + timedelta(days=3)).isoformat(),
            "request_message": "Need it"}
    r = requests.post(f"{BASE}/api/transactions", json=body, headers=H(tokens["u2"]))
    assert r.status_code == 200, r.text
    return r.json()["transaction"], target


class TestTransactions:
    def test_request_locks_item(self, fresh_tx, tokens):
        tx, item = fresh_tx
        assert tx["status"] == "Pending"
        # item should now be Pending
        g = requests.get(f"{BASE}/api/items/{item['id']}")
        assert g.json()["item"]["availability_status"] == "Pending"

    def test_lender_notified(self, fresh_tx, tokens):
        r = requests.get(f"{BASE}/api/notifications", headers=H(tokens["u1"]))
        assert r.status_code == 200
        kinds = [n.get("notification_type") for n in r.json()["notifications"]]
        assert "RequestReceived" in kinds

    def test_second_request_conflict(self, fresh_tx, tokens):
        tx, item = fresh_tx
        from datetime import date, timedelta
        body = {"item_id": item["id"], "borrow_start_date": date.today().isoformat(),
                "borrow_end_date": (date.today() + timedelta(days=2)).isoformat()}
        r = requests.post(f"{BASE}/api/transactions", json=body, headers=H(tokens["u3"]))
        assert r.status_code == 409

    def test_invalid_dates(self, tokens):
        items = requests.get(f"{BASE}/api/items").json()["items"]
        target = items[0]
        from datetime import date, timedelta
        # past start
        body = {"item_id": target["id"],
                "borrow_start_date": (date.today() - timedelta(days=1)).isoformat(),
                "borrow_end_date": (date.today() + timedelta(days=2)).isoformat()}
        r = requests.post(f"{BASE}/api/transactions", json=body, headers=H(tokens["u2"]))
        assert r.status_code == 400
        # end <= start
        body2 = {"item_id": target["id"], "borrow_start_date": date.today().isoformat(),
                 "borrow_end_date": date.today().isoformat()}
        r2 = requests.post(f"{BASE}/api/transactions", json=body2, headers=H(tokens["u2"]))
        assert r2.status_code == 400

