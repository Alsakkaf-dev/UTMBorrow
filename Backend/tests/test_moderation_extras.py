"""Extra moderation tests: remove-item, suspend-user, listings-hidden-after-suspend.

Run after the main suite. Creates a throwaway user, listing, and report so we
don't pollute the seeded admin queue or break the main flow.
"""
import os
import uuid
import requests
from datetime import date, timedelta

BASE = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
PW = "Test1234"


def H(t): return {"Authorization": f"Bearer {t}"}


def _login(email, pw=PW):
    return requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": pw}).json()["token"]


def _register():
    suffix = uuid.uuid4().hex[:8]
    email = f"mod_{suffix}@utm.my"
    matric = f"M{suffix.upper()}"
    r = requests.post(f"{BASE}/api/auth/register", json={
        "full_name": "Mod Target", "matric_no": matric, "email": email, "password": PW})
    assert r.status_code == 200, r.text
    return r.json()["token"], r.json()["user"]


def test_admin_remove_item_flow():
    admin_tok = _login("admin@utm.my")
    target_tok, target_user = _register()
    reporter_tok = _login("alsakkaf@graduate.utm.my")

    # target user creates an item
    body = {"title": f"TEST_REMOVE_{uuid.uuid4().hex[:6]}", "category": "Other",
            "condition": "Good", "location_college": "KTF"}
    item = requests.post(f"{BASE}/api/items", json=body, headers=H(target_tok)).json()["item"]

    # alsakkaf reports it
    rep = requests.post(f"{BASE}/api/reports", headers=H(reporter_tok), json={
        "item_id": item["id"], "report_category": "Prohibited_Illegal",
        "description": "test"}).json()["report"]

    # admin views detail (transitions to Under_Review)
    requests.get(f"{BASE}/api/admin/reports/{rep['id']}", headers=H(admin_tok))

    # admin removes item
    r = requests.post(f"{BASE}/api/admin/reports/{rep['id']}/remove-item",
                      json={"reason": "violates terms"}, headers=H(admin_tok))
    assert r.status_code == 200, r.text

    # item should now 404 (Removed)
    g = requests.get(f"{BASE}/api/items/{item['id']}")
    assert g.status_code == 404

    # owner got Item_Removed notification
    notes = requests.get(f"{BASE}/api/notifications", headers=H(target_tok)).json()["notifications"]
    assert any(n.get("notification_type") == "Item_Removed" for n in notes)


def test_admin_suspend_user_hides_listings():
    admin_tok = _login("admin@utm.my")
    target_tok, target_user = _register()
    reporter_tok = _login("muaz@graduate.utm.my")

    body = {"title": f"TEST_SUSPEND_{uuid.uuid4().hex[:6]}", "category": "Other",
            "condition": "Good", "location_college": "KTF"}
    item = requests.post(f"{BASE}/api/items", json=body, headers=H(target_tok)).json()["item"]

    # browse: item should be visible
    items = requests.get(f"{BASE}/api/items").json()["items"]
    assert any(i["id"] == item["id"] for i in items)

    rep = requests.post(f"{BASE}/api/reports", headers=H(reporter_tok), json={
        "item_id": item["id"], "report_category": "False_Scam"}).json()["report"]

    requests.get(f"{BASE}/api/admin/reports/{rep['id']}", headers=H(admin_tok))
    r = requests.post(f"{BASE}/api/admin/reports/{rep['id']}/suspend-user",
                      json={"suspension_type": "3_Day", "reason": "spam"},
                      headers=H(admin_tok))
    assert r.status_code == 200, r.text

    # listings of suspended user must no longer appear in browse
    items = requests.get(f"{BASE}/api/items").json()["items"]
    assert not any(i["id"] == item["id"] for i in items)


def test_timed_suspend_blocks_login():
    admin_tok = _login("admin@utm.my")
    target_tok, target_user = _register()
    reporter_tok = _login("muaz@graduate.utm.my")

    body = {"title": f"TEST_SUSPEND_LOGIN_{uuid.uuid4().hex[:6]}", "category": "Other",
            "condition": "Good", "location_college": "KTF"}
    item = requests.post(f"{BASE}/api/items", json=body, headers=H(target_tok)).json()["item"]

    rep = requests.post(f"{BASE}/api/reports", headers=H(reporter_tok), json={
        "item_id": item["id"], "report_category": "False_Scam"}).json()["report"]

    requests.get(f"{BASE}/api/admin/reports/{rep['id']}", headers=H(admin_tok))
    r = requests.post(f"{BASE}/api/admin/reports/{rep['id']}/suspend-user",
                      json={"suspension_type": "3_Day", "reason": "spam"},
                      headers=H(admin_tok))
    assert r.status_code == 200, r.text

    login = requests.post(f"{BASE}/api/auth/login",
                          json={"email": target_user["email"], "password": PW})
    assert login.status_code == 403
    assert "suspend" in login.json()["detail"].lower()


def test_permanent_ban_blocks_login():
    admin_tok = _login("admin@utm.my")
    target_tok, target_user = _register()
    reporter_tok = _login("ahmat@graduate.utm.my")
    body = {"title": f"TEST_BAN_{uuid.uuid4().hex[:6]}", "category": "Other",
            "condition": "Good", "location_college": "KTF"}
    item = requests.post(f"{BASE}/api/items", json=body, headers=H(target_tok)).json()["item"]
    rep = requests.post(f"{BASE}/api/reports", headers=H(reporter_tok), json={
        "item_id": item["id"], "report_category": "Damaged_Dangerous"}).json()["report"]
    requests.get(f"{BASE}/api/admin/reports/{rep['id']}", headers=H(admin_tok))
    r = requests.post(f"{BASE}/api/admin/reports/{rep['id']}/suspend-user",
                      json={"suspension_type": "Permanent", "reason": "abuse"},
                      headers=H(admin_tok))
    assert r.status_code == 200, r.text
    # login blocked
    login = requests.post(f"{BASE}/api/auth/login",
                         json={"email": target_user["email"], "password": PW})
    assert login.status_code == 403
