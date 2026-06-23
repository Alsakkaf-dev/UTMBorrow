"""Idempotent seed data (spec section 9) — makes the app demo-ready instantly.

Assumption noted inline: the explicit trust_scores in the spec are treated as
pre-existing historical averages and set directly; the live recompute only runs
on NEW transaction completions inside the app.
"""
from datetime import timedelta, date

from database import db, new_id, now_utc, iso
from security import hash_password
from qr_engine import generate_token


async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("matric_no", unique=True)
    await db.users.create_index("id", unique=True)
    await db.items.create_index("id", unique=True)
    await db.transactions.create_index("id", unique=True)
    await db.reports.create_index([("reporter_id", 1), ("reported_item_id", 1)], unique=True)
    await db.user_ratings.create_index([("transaction_id", 1), ("rater_id", 1)], unique=True)
    await db.notifications.create_index("recipient_user_id")
    await db.admin_audit.create_index("created_at")
    await db.penalties.create_index("user_id")


async def _log(transaction_id, prev, new, by, reason=None):
    await db.transaction_state_logs.insert_one({
        "id": new_id(), "transaction_id": transaction_id,
        "previous_status": prev, "new_status": new,
        "changed_by_user_id": by, "change_reason": reason,
        "created_at": iso(now_utc()),
    })


async def seed():
    # Never auto-seed over an existing dataset. The demo/reset seed
    # (reset_and_seed.py) populates a richer set of records directly; if the
    # DB already has any users, leave it untouched on startup.
    if await db.users.count_documents({}) > 0:
        return  # already populated

    pw = hash_password("Test1234")
    ts = iso(now_utc())

    users = [
        {"id": new_id(), "matric_no": "A23CS4026", "full_name": "Mohammed Alsakkaf",
         "email": "alsakkaf@graduate.utm.my", "trust_score": 4.8},
        {"id": new_id(), "matric_no": "A23CS4062", "full_name": "Muaz Ibne Ahmed",
         "email": "muaz@graduate.utm.my", "trust_score": 4.5},
        {"id": new_id(), "matric_no": "A24CS4053", "full_name": "Ahmat Mahamat",
         "email": "ahmat@graduate.utm.my", "trust_score": 5.0},
        {"id": new_id(), "matric_no": "STAFF001", "full_name": "Admin Moderator",
         "email": "admin@utm.my", "trust_score": 5.0},
    ]
    for u in users:
        u.update({
            "password_hash": pw, "profile_picture": None, "phone_number": None,
            "account_status": "Active", "is_active": True, "created_at": ts,
        })
    await db.users.insert_many([dict(u) for u in users])
    u1, u2, u3, admin_u = [u["id"] for u in users]

    admin_id = new_id()
    await db.admins.insert_one({
        "id": admin_id, "user_id": admin_u, "role": "Senior_Moderator",
        "is_active": True, "granted_by_admin_id": None,
        "granted_at": ts, "revoked_at": None,
    })

    items_def = [
        ("Scientific Calculator", "Electronics", "Good", "Kolej Tuanku Canselor", "Computing", u1),
        ("Lab Coat", "Lab Equipment", "Like New", "Kolej 9", "Engineering", u2),
        ("Engineering Drawing Set", "Tools", "Good", "Kolej Perdana", "Engineering", u3),
        ("Formal Blazer", "Clothing", "Fair", "Kolej Tuanku Canselor", None, u1),
        ("Data Structures Textbook", "Textbooks", "Good", "Kolej 9", "Computing", u2),
        ("Arduino Starter Kit", "Electronics", "Like New", "Kolej Rahman Putra", "Engineering", u3),
        ("Safety Goggles", "Lab Equipment", "Good", "Kolej Perdana", "Engineering", u1),
        ("Graphic Tablet", "Electronics", "Fair", "Kolej Rahman Putra", None, u2),
    ]
    descriptions = {
        "Scientific Calculator": "Casio fx-991EX, perfect for engineering math. Fully working.",
        "Lab Coat": "Brand new white lab coat, size M. Never used.",
        "Engineering Drawing Set": "Complete drafting set with compass, set squares and rulers.",
        "Formal Blazer": "Navy formal blazer for presentations and viva. Size L.",
        "Data Structures Textbook": "Cormen Introduction to Algorithms, lightly used.",
        "Arduino Starter Kit": "Arduino Uno + breadboard + sensors + jumper wires.",
        "Safety Goggles": "Anti-fog lab safety goggles, sanitized.",
        "Graphic Tablet": "Wacom Intuos drawing tablet with pen. Some scratches.",
    }
    items = []
    for title, cat, cond, col, fac, owner in items_def:
        items.append({
            "id": new_id(), "owner_id": owner, "title": title,
            "description": descriptions[title], "category": cat, "condition": cond,
            "location_college": col, "location_faculty": fac, "photo_url": None,
            "availability_status": "Available", "visibility": "Public",
            "report_count": 0, "created_at": ts, "last_refreshed_at": ts,
        })
    await db.items.insert_many([dict(i) for i in items])
    item = {i["title"]: i["id"] for i in items}

    today = date.today()

    async def make_tx(borrower, lender, item_id, status, start, end, message):
        tx = {
            "id": new_id(), "borrower_id": borrower, "lender_id": lender,
            "item_id": item_id, "request_message": message,
            "borrow_start_date": start.isoformat(), "borrow_end_date": end.isoformat(),
            "status": status, "rejection_reason": None, "cancellation_reason": None,
            "cancelled_by": None, "approval_timestamp": None,
            "created_at": ts, "updated_at": ts,
        }
        await db.transactions.insert_one(tx)
        await _log(tx["id"], None, status, borrower)
        return tx

    # T1 — Pending (borrower u2, lender u1, Scientific Calculator)
    await make_tx(u2, u1, item["Scientific Calculator"], "Pending",
                  today, today + timedelta(days=5), "Need it for my exam next week.")
    await db.items.update_one({"id": item["Scientific Calculator"]}, {"$set": {"availability_status": "Pending"}})

    # T2 — Approved with generated QR (borrower u3, lender u2, Data Structures Textbook)
    t2 = await make_tx(u3, u2, item["Data Structures Textbook"], "Approved",
                       today, today + timedelta(days=7), "Studying for algorithms final.")
    await db.transactions.update_one({"id": t2["id"]}, {"$set": {"approval_timestamp": ts}})
    await db.items.update_one({"id": item["Data Structures Textbook"]}, {"$set": {"availability_status": "Pending"}})
    qr_string, payload_b64, sig, nonce, iat, exp = generate_token(t2["id"], u3)
    await db.qr_tokens.insert_one({
        "id": new_id(), "transaction_id": t2["id"], "borrower_id": u3,
        "token_payload": payload_b64, "token_hash": sig, "cryptographic_nonce": nonce,
        "algorithm": "HMAC-SHA256", "qr_string": qr_string,
        "issued_at": iso(iat), "expires_at": iso(exp), "is_revoked": False,
        "revoked_at": None, "created_at": ts,
    })

    # T3 — Borrowed, active lease, due within 24h (borrower u1, lender u3, Arduino Kit)
    t3 = await make_tx(u1, u3, item["Arduino Starter Kit"], "Borrowed",
                       today - timedelta(days=3), today, "For my IoT project.")
    await db.transactions.update_one({"id": t3["id"]}, {"$set": {"approval_timestamp": ts}})
    await db.items.update_one({"id": item["Arduino Starter Kit"]}, {"$set": {"availability_status": "Borrowed"}})
    qr3, pb3, s3, n3, i3, e3 = generate_token(t3["id"], u1)
    await db.qr_tokens.insert_one({
        "id": new_id(), "transaction_id": t3["id"], "borrower_id": u1,
        "token_payload": pb3, "token_hash": s3, "cryptographic_nonce": n3,
        "algorithm": "HMAC-SHA256", "qr_string": qr3,
        "issued_at": iso(i3), "expires_at": iso(e3), "is_revoked": False,
        "revoked_at": None, "created_at": ts,
    })
    handover_scan = {
        "id": new_id(), "token_id": None, "transaction_id": t3["id"],
        "scanned_by_user_id": u3, "scan_purpose": "Handover", "scan_result": "Success",
        "device_info": "Seed", "error_message": None,
        "scanned_at": iso(now_utc()), "created_at": ts,
    }
    await db.scan_events.insert_one(handover_scan)
    await db.lease_cycles.insert_one({
        "id": new_id(), "transaction_id": t3["id"],
        "handover_scan_event_id": handover_scan["id"], "return_scan_event_id": None,
        "handover_timestamp": iso(now_utc()), "return_timestamp": None,
        "expected_return_date": today.isoformat(), "lease_status": "Active",
        "overdue_days": 0, "created_at": ts, "updated_at": ts,
    })

    # T4 — Completed with mutual ratings (borrower u2, lender u3, Engineering Drawing Set)
    t4 = await make_tx(u2, u3, item["Engineering Drawing Set"], "Completed",
                       today - timedelta(days=14), today - timedelta(days=7), "Drafting assignment.")
    await db.transactions.update_one({"id": t4["id"]}, {"$set": {"approval_timestamp": ts}})
    await db.lease_cycles.insert_one({
        "id": new_id(), "transaction_id": t4["id"],
        "handover_scan_event_id": None, "return_scan_event_id": None,
        "handover_timestamp": iso(now_utc()), "return_timestamp": iso(now_utc()),
        "expected_return_date": (today - timedelta(days=7)).isoformat(),
        "lease_status": "Completed", "overdue_days": 0, "created_at": ts, "updated_at": ts,
    })
    for rater, ratee, stars, fb in [(u2, u3, 5, "Great lender, item as described!"),
                                    (u3, u2, 5, "Returned on time and in good condition.")]:
        await db.user_ratings.insert_one({
            "id": new_id(), "rater_id": rater, "ratee_id": ratee,
            "transaction_id": t4["id"], "stars": stars, "feedback": fb,
            "created_at": ts,
        })

    # T5 — Borrowed & OVERDUE (borrower u1, lender u2, Lab Coat) for admin oversight demo
    t5 = await make_tx(u1, u2, item["Lab Coat"], "Borrowed",
                       today - timedelta(days=6), today - timedelta(days=4), "For a lab session.")
    await db.transactions.update_one({"id": t5["id"]}, {"$set": {"approval_timestamp": ts}})
    await db.items.update_one({"id": item["Lab Coat"]}, {"$set": {"availability_status": "Borrowed"}})
    qr5, pb5, s5, n5, i5, e5 = generate_token(t5["id"], u1)
    await db.qr_tokens.insert_one({
        "id": new_id(), "transaction_id": t5["id"], "borrower_id": u1,
        "token_payload": pb5, "token_hash": s5, "cryptographic_nonce": n5,
        "algorithm": "HMAC-SHA256", "qr_string": qr5,
        "issued_at": iso(i5), "expires_at": iso(e5), "is_revoked": False,
        "revoked_at": None, "created_at": ts,
    })
    await db.lease_cycles.insert_one({
        "id": new_id(), "transaction_id": t5["id"],
        "handover_scan_event_id": None, "return_scan_event_id": None,
        "handover_timestamp": iso(now_utc()), "return_timestamp": None,
        "expected_return_date": (today - timedelta(days=4)).isoformat(),
        "lease_status": "Active", "overdue_days": 4, "created_at": ts, "updated_at": ts,
    })

    # One Pending report sitting in the admin queue (reporter u3, item Graphic Tablet owned by u2)
    await db.reports.insert_one({
        "id": new_id(), "reporter_id": u3,
        "reported_item_id": item["Graphic Tablet"], "reported_user_id": u2,
        "report_category": "False_Listing",
        "description": "The photos don't match the actual condition of the tablet.",
        "report_status": "Pending", "reviewed_by_admin_id": None, "reviewed_at": None,
        "dismissal_note": None, "submitted_at": ts, "created_at": ts, "updated_at": ts,
    })
    await db.items.update_one({"id": item["Graphic Tablet"]}, {"$inc": {"report_count": 1}})
