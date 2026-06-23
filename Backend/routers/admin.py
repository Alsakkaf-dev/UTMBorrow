"""Admin Portal — secure, MFA-gated oversight for a campus-scale community.

This is a strict Role-Based Access Control surface layered ON TOP of the
peer-to-peer student flow (lenders still approve their own requests). It adds:

  * Secure gateway     — TOTP step-up elevation (see /admin/auth/*).
  * Transaction control — real-time oversight + force cancel/complete.
  * Asset QR check      — admin can scan any handover/return QR on the spot.
  * Oversight & audit   — overdue tracking, penalties, user management, and an
                          immutable, unified audit log of every admin action.

Every elevated endpoint depends on get_admin_session (an MFA-minted token) and
every mutating action is written to the `admin_audit` collection.
"""
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from database import db, new_id, now_utc, iso, clean
from security import (
    get_current_admin, get_admin_session, create_admin_token, ADMIN_SESSION_MINUTES,
)
from notifications import notify
from realtime import broadcaster
from qr_engine import parse_and_verify
from tx_common import log_transition, enrich_transaction, compute_lease_flags
import mfa

router = APIRouter(prefix="/api/admin", tags=["admin"])

SUSPENSION_DAYS = {"3_Day": 3, "7_Day": 7, "30_Day": 30, "Permanent": None}
NON_TERMINAL = {"Approved", "Borrowed", "Pending"}

# What an elevated admin session is permitted to do, by role. Surfaced read-only
# on the admin's own profile page for accountability/transparency.
ROLE_PERMISSIONS = {
    "Senior_Moderator": [
        "Review and resolve reports & disputes",
        "Suspend, ban, and reinstate user accounts",
        "Apply trust-score penalties",
        "Force-cancel or force-complete transactions",
        "Permanently delete listings and user accounts",
        "Scan handover / return QR codes at the help desk",
        "View the full immutable audit log",
    ],
    "Moderator": [
        "Review and resolve reports & disputes",
        "Suspend and reinstate user accounts",
        "Apply trust-score penalties",
        "Send overdue reminders",
    ],
}
DEFAULT_PERMISSIONS = ROLE_PERMISSIONS["Senior_Moderator"]


def _require_senior(admin: dict):
    """Gate the most destructive actions to Senior_Moderator, matching the
    ROLE_PERMISSIONS table (permanent deletes + force cancel/complete)."""
    if admin.get("admin_role") != "Senior_Moderator":
        raise HTTPException(status_code=403,
                            detail="Senior moderator privileges are required for this action.")


async def log_admin_action(admin: dict, action_type: str, summary: str,
                           target_user_id: str = None, target_item_id: str = None,
                           target_transaction_id: str = None, meta: dict = None):
    entry = {
        "id": new_id(),
        "admin_id": admin.get("admin_id"),
        "admin_user_id": admin["id"],
        "admin_name": admin.get("full_name"),
        "admin_role": admin.get("admin_role"),
        "action_type": action_type,
        "summary": summary,
        "target_user_id": target_user_id,
        "target_item_id": target_item_id,
        "target_transaction_id": target_transaction_id,
        "meta": meta or {},
        "created_at": iso(now_utc()),
    }
    await db.admin_audit.insert_one(entry)
    admin_ids = [a["user_id"] async for a in db.admins.find({"is_active": True})]
    await broadcaster.publish_to(admin_ids, "admin.changed", {"action": action_type})
    return entry

class ElevateIn(BaseModel):
    code: str = Field(min_length=6, max_length=10)


@router.post("/auth/elevate/start")
async def elevate_start(admin: dict = Depends(get_current_admin)):
    """Begin step-up: ensure a TOTP secret exists and return enrolment data."""
    record = await db.admins.find_one({"id": admin["admin_id"]})
    secret = record.get("mfa_secret")
    if not secret:
        secret = mfa.generate_secret()
        await db.admins.update_one({"id": admin["admin_id"]},
                                   {"$set": {"mfa_secret": secret, "mfa_enrolled": False}})
    enrolled = bool(record.get("mfa_enrolled"))
    out = {
        "enrolled": enrolled,


        "otpauth_uri": None if enrolled else mfa.provisioning_uri(secret, admin["email"]),
    }
    if mfa.dev_hint_enabled():
        out["dev_code"] = mfa.current_code(secret)
        out["dev_hint"] = "Development only: live TOTP code (disable with ADMIN_MFA_DEV_HINT=0)."
    return out


@router.post("/auth/elevate")
async def elevate(body: ElevateIn, admin: dict = Depends(get_current_admin)):
    """Verify a TOTP code and mint a short-lived elevated admin token."""
    record = await db.admins.find_one({"id": admin["admin_id"]})
    secret = record.get("mfa_secret")
    if not secret:
        raise HTTPException(status_code=400, detail="Start enrolment first.")
    if not mfa.verify(secret, body.code):
        raise HTTPException(status_code=401, detail="Invalid or expired authentication code.")
    if not record.get("mfa_enrolled"):
        await db.admins.update_one({"id": admin["admin_id"]}, {"$set": {"mfa_enrolled": True}})
    token = create_admin_token(admin["id"], admin["email"])
    await log_admin_action(admin, "Session_Elevated", "Passed MFA and opened the admin portal.")
    return {
        "admin_token": token,
        "expires_in_minutes": ADMIN_SESSION_MINUTES,
        "admin_role": admin["admin_role"],
        "full_name": admin["full_name"],
    }


@router.get("/session")
async def session_check(admin: dict = Depends(get_admin_session)):
    """Lightweight probe the frontend uses to confirm the elevated session."""
    return {"ok": True, "admin_role": admin["admin_role"], "full_name": admin["full_name"]}


# ------------------- Admin self-service (profile / account) -------------------
RESOLUTION_ACTIONS = {"Force_Cancel", "Force_Complete", "Report_Resolved", "Report_Dismissed"}


@router.get("/me")
async def admin_me(admin: dict = Depends(get_admin_session)):
    """The signed-in admin's own profile: role, permissions, MFA status, alert
    preferences, and a personal-accountability tally of their moderation actions."""
    record = await db.admins.find_one({"id": admin["admin_id"]}) or {}
    role = admin["admin_role"]
    prefs = record.get("alert_prefs") or {"email": True, "sms": False}
    q = {"admin_user_id": admin["id"]}
    stats = {
        "total_actions": await db.admin_audit.count_documents(q),
        "penalties": await db.admin_audit.count_documents({**q, "action_type": "Penalty_Applied"}),
        "suspensions": await db.admin_audit.count_documents({**q, "action_type": {"$in": ["User_Suspended", "User_Reinstated"]}}),
        "resolutions": await db.admin_audit.count_documents({**q, "action_type": {"$in": list(RESOLUTION_ACTIONS)}}),
    }
    return {
        "id": admin["id"],
        "admin_id": admin["admin_id"],
        "full_name": admin["full_name"],
        "email": admin["email"],
        "matric_no": admin.get("matric_no"),
        "role": role,
        "role_label": role.replace("_", " "),
        "permissions": ROLE_PERMISSIONS.get(role, DEFAULT_PERMISSIONS),
        "mfa_enrolled": bool(record.get("mfa_enrolled")),
        "granted_at": record.get("granted_at"),
        "session_minutes": ADMIN_SESSION_MINUTES,
        "alert_prefs": {"email": bool(prefs.get("email")), "sms": bool(prefs.get("sms"))},
        "stats": stats,
    }


class AlertPrefsIn(BaseModel):
    email: bool
    sms: bool


@router.patch("/me/alerts")
async def update_alert_prefs(body: AlertPrefsIn, admin: dict = Depends(get_admin_session)):
    """Opt in/out of instant Email/SMS alerts for high-priority user reports
    (e.g. stolen or unreturned items)."""
    prefs = {"email": bool(body.email), "sms": bool(body.sms)}
    await db.admins.update_one({"id": admin["admin_id"]}, {"$set": {"alert_prefs": prefs}})
    return {"ok": True, "alert_prefs": prefs}


@router.get("/me/activity")
async def admin_my_activity(admin: dict = Depends(get_admin_session), limit: int = Query(default=60, le=200)):
    """This admin's personal moderation history — penalties, suspensions, and
    dispute resolutions they performed — for accountability."""
    entries = await db.admin_audit.find({"admin_user_id": admin["id"]}).sort("created_at", -1).to_list(limit)
    return {"entries": [clean(e) for e in entries]}


@router.get("/overview")
async def overview(admin: dict = Depends(get_admin_session)):
    users_total = await db.users.count_documents({})
    suspended = await db.users.count_documents({"account_status": {"$in": ["Suspended", "Banned"]}})
    items_total = await db.items.count_documents({"availability_status": {"$ne": "Removed"}})
    active_loans = await db.transactions.count_documents({"status": "Borrowed"})
    pending_req = await db.transactions.count_documents({"status": "Pending"})
    pending_reports = await db.reports.count_documents({"report_status": {"$in": ["Pending", "Under_Review"]}})

    overdue = 0
    async for lease in db.lease_cycles.find({"lease_status": "Active"}):
        is_overdue, _, _ = compute_lease_flags(lease.get("expected_return_date"))
        if is_overdue:
            overdue += 1
    recent = await db.admin_audit.find({}).sort("created_at", -1).to_list(8)
    return {
        "stats": {
            "users_total": users_total,
            "suspended": suspended,
            "items_total": items_total,
            "active_loans": active_loans,
            "pending_requests": pending_req,
            "pending_reports": pending_reports,
            "overdue": overdue,
        },
        "recent_actions": [clean(r) for r in recent],
    }

class ReasonIn(BaseModel):
    reason: str = Field(min_length=2, max_length=500)


@router.get("/transactions")
async def list_transactions(
    admin: dict = Depends(get_admin_session),
    status: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
):
    query = {}
    if status and status != "All":
        query["status"] = status
    txs = await db.transactions.find(query).sort("updated_at", -1).to_list(400)
    out = [await enrich_transaction(t) for t in txs]
    if q:
        ql = q.lower()
        out = [
            t for t in out
            if ql in t["item"].get("title", "").lower()
            or ql in (t.get("borrower") or {}).get("full_name", "").lower()
            or ql in (t.get("lender") or {}).get("full_name", "").lower()
        ]
    return {"transactions": out}


@router.get("/transactions/{tx_id}")
async def admin_tx_detail(tx_id: str, admin: dict = Depends(get_admin_session)):
    tx = await db.transactions.find_one({"id": tx_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    detail = await enrich_transaction(tx)
    logs = await db.transaction_state_logs.find({"transaction_id": tx_id}).sort("created_at", 1).to_list(100)
    scans = await db.scan_events.find({"transaction_id": tx_id}).sort("scanned_at", 1).to_list(100)
    detail["state_logs"] = [clean(x) for x in logs]
    detail["scan_events"] = [clean(x) for x in scans]
    return {"transaction": detail}


@router.post("/transactions/{tx_id}/force-cancel")
async def force_cancel(tx_id: str, body: ReasonIn, admin: dict = Depends(get_admin_session)):
    _require_senior(admin)
    tx = await db.transactions.find_one({"id": tx_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    if tx["status"] not in NON_TERMINAL:
        raise HTTPException(status_code=400, detail=f"Cannot cancel a {tx['status']} transaction.")
    await db.transactions.update_one({"id": tx_id}, {"$set": {
        "status": "Cancelled",
        "cancellation_reason": f"[Admin] {body.reason}",
        "cancelled_by": "Admin",
        "updated_at": iso(now_utc()),
    }})
    await db.items.update_one({"id": tx["item_id"]}, {"$set": {"availability_status": "Available"}})
    await db.lease_cycles.update_one({"transaction_id": tx_id}, {"$set": {"lease_status": "Completed", "updated_at": iso(now_utc())}})
    await log_transition(tx_id, tx["status"], "Cancelled", admin["id"], f"Admin override: {body.reason}")
    for uid in (tx["borrower_id"], tx["lender_id"]):
        await notify(uid, "AdminAction", f"An administrator cancelled a transaction. Reason: {body.reason}", transaction_id=tx_id)
    await broadcaster.publish("catalog.changed", {"reason": "admin_cancel", "item_id": tx["item_id"]})
    await broadcaster.publish_to([tx["borrower_id"], tx["lender_id"]], "transaction.updated", {"transaction_id": tx_id, "status": "Cancelled", "item_id": tx["item_id"]})
    await log_admin_action(admin, "Force_Cancel", f"Force-cancelled transaction. {body.reason}", target_transaction_id=tx_id, target_user_id=tx["borrower_id"], target_item_id=tx["item_id"])
    return {"ok": True}


@router.post("/transactions/{tx_id}/force-complete")
async def force_complete(tx_id: str, body: ReasonIn, admin: dict = Depends(get_admin_session)):
    _require_senior(admin)
    tx = await db.transactions.find_one({"id": tx_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    if tx["status"] != "Borrowed":
        raise HTTPException(status_code=400, detail="Only an active (Borrowed) loan can be force-completed.")
    await db.transactions.update_one({"id": tx_id}, {"$set": {"status": "Completed", "updated_at": iso(now_utc())}})
    await db.items.update_one({"id": tx["item_id"]}, {"$set": {"availability_status": "Available"}})
    await db.lease_cycles.update_one({"transaction_id": tx_id}, {"$set": {"return_timestamp": iso(now_utc()), "lease_status": "Completed", "updated_at": iso(now_utc())}})
    await log_transition(tx_id, "Borrowed", "Completed", admin["id"], f"Admin force-complete: {body.reason}")
    for uid in (tx["borrower_id"], tx["lender_id"]):
        await notify(uid, "AdminAction", f"An administrator marked a loan as returned. Reason: {body.reason}", transaction_id=tx_id)
    await broadcaster.publish("catalog.changed", {"reason": "admin_complete", "item_id": tx["item_id"]})
    await broadcaster.publish_to([tx["borrower_id"], tx["lender_id"]], "transaction.updated", {"transaction_id": tx_id, "status": "Completed", "item_id": tx["item_id"]})
    await log_admin_action(admin, "Force_Complete", f"Force-completed loan. {body.reason}", target_transaction_id=tx_id, target_item_id=tx["item_id"])
    return {"ok": True}


@router.get("/overdue")
async def overdue_list(admin: dict = Depends(get_admin_session)):
    out = []
    async for lease in db.lease_cycles.find({"lease_status": "Active"}):
        is_overdue, due_soon, overdue_days = compute_lease_flags(lease.get("expected_return_date"))
        if not is_overdue:
            continue
        tx = await db.transactions.find_one({"id": lease["transaction_id"]})
        if not tx or tx["status"] != "Borrowed":
            continue
        detail = await enrich_transaction(tx)
        detail["overdue_days"] = overdue_days
        out.append(detail)
    out.sort(key=lambda t: t.get("overdue_days", 0), reverse=True)
    return {"overdue": out}


@router.post("/transactions/{tx_id}/remind")
async def remind(tx_id: str, admin: dict = Depends(get_admin_session)):
    tx = await db.transactions.find_one({"id": tx_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    if tx["status"] != "Borrowed":
        raise HTTPException(status_code=400, detail="Reminders apply to active loans only.")
    item = await db.items.find_one({"id": tx["item_id"]})
    title = item["title"] if item else "an item"
    await notify(tx["borrower_id"], "OverdueReminder", f"Reminder from UTM Borrow admin: please return '{title}' (due {tx['borrow_end_date']}).", transaction_id=tx_id)
    await log_admin_action(admin, "Reminder_Sent", f"Sent an overdue reminder for '{title}'.", target_transaction_id=tx_id, target_user_id=tx["borrower_id"])
    return {"ok": True}












class PenaltyIn(BaseModel):
    points: float = Field(ge=0.1, le=5.0)
    reason: str = Field(min_length=2, max_length=500)


@router.post("/transactions/{tx_id}/penalize")
async def penalize(tx_id: str, body: PenaltyIn, admin: dict = Depends(get_admin_session)):
    tx = await db.transactions.find_one({"id": tx_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    borrower = await db.users.find_one({"id": tx["borrower_id"]})
    if not borrower:
        raise HTTPException(status_code=404, detail="Borrower not found.")
    new_score = max(0.0, round(float(borrower.get("trust_score", 5.0)) - body.points, 2))
    await db.users.update_one({"id": borrower["id"]}, {"$set": {"trust_score": new_score}})
    penalty = {
        "id": new_id(),
        "user_id": borrower["id"],
        "transaction_id": tx_id,
        "points": body.points,
        "reason": body.reason,
        "issued_by_admin_id": admin["admin_id"],
        "trust_score_after": new_score,
        "created_at": iso(now_utc()),
    }
    await db.penalties.insert_one(penalty)
    await notify(borrower["id"], "PenaltyApplied", f"A trust-score penalty of -{body.points} was applied. Reason: {body.reason}", transaction_id=tx_id)
    await log_admin_action(admin, "Penalty_Applied", f"Applied -{body.points} trust penalty to {borrower['full_name']}. {body.reason}", target_transaction_id=tx_id, target_user_id=borrower["id"], meta={"points": body.points, "trust_score_after": new_score})
    return {"ok": True, "trust_score_after": new_score}


@router.get("/users")
async def list_users(
    admin: dict = Depends(get_admin_session),
    q: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
):
    query = {}
    if status and status != "All":
        query["account_status"] = status
    if q:
        query["$or"] = [
            {"full_name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"matric_no": {"$regex": q, "$options": "i"}},
        ]
    users = await db.users.find(query).sort("created_at", -1).to_list(300)
    admin_user_ids = {a["user_id"] async for a in db.admins.find({"is_active": True})}
    requesting_admin_uid = admin["id"]   # never show the admin themselves
    out = []
    for u in users:
        if u["id"] == requesting_admin_uid:
            continue
        u = clean(u)
        u.pop("password_hash", None)
        u["is_admin"] = u["id"] in admin_user_ids
        u["active_loans"] = await db.transactions.count_documents({"$or": [{"borrower_id": u["id"]}, {"lender_id": u["id"]}], "status": "Borrowed"})
        u["listings"] = await db.items.count_documents({"owner_id": u["id"], "availability_status": {"$ne": "Removed"}})
        out.append(u)
    return {"users": out}




class SuspendIn(BaseModel):
    suspension_type: str
    reason: str = Field(min_length=2, max_length=500)
    post_action: str = "keep"   # "keep" | "remove" — what to do with the user's listings


@router.post("/users/{user_id}/suspend")
async def suspend_user(user_id: str, body: SuspendIn, admin: dict = Depends(get_admin_session)):
    if body.suspension_type not in SUSPENSION_DAYS:
        raise HTTPException(status_code=400, detail="Invalid suspension type.")
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if user_id in {a["user_id"] async for a in db.admins.find({"is_active": True})}:
        raise HTTPException(status_code=400, detail="You cannot suspend an administrator account.")
    permanent = body.suspension_type == "Permanent"
    days = SUSPENSION_DAYS[body.suspension_type]
    start = now_utc()
    end = None if permanent else start + timedelta(days=days)
    await db.users.update_one({"id": user_id}, {"$set": {"account_status": "Banned" if permanent else "Suspended"}})
    await db.user_suspensions.insert_one({
        "id": new_id(),
        "user_id": user_id,
        "action_id": None,
        "suspended_by_admin_id": admin["admin_id"],
        "suspension_type": body.suspension_type,
        "start_at": iso(start),
        "end_at": iso(end) if end else None,
        "is_active": True,
        "reason": body.reason,
        "created_at": iso(now_utc()),
    })
    # Optionally soft-remove the user's listings
    removed_count = 0
    if body.post_action == "remove":
        result = await db.items.update_many(
            {"owner_id": user_id, "availability_status": {"$ne": "Removed"}},
            {"$set": {"availability_status": "Removed"}},
        )
        removed_count = result.modified_count
    await notify(user_id, "Account_Suspended", f"Your account has been {'permanently banned' if permanent else f'suspended ({body.suspension_type.replace(chr(95), chr(32))})'}. Reason: {body.reason}")
    await broadcaster.publish("catalog.changed", {"reason": "user_suspended"})
    await log_admin_action(admin, "User_Suspended",
                           f"{'Banned' if permanent else 'Suspended'} {target['full_name']} ({body.suspension_type}). "
                           f"Posts: {body.post_action} ({removed_count} removed). {body.reason}",
                           target_user_id=user_id,
                           meta={"suspension_type": body.suspension_type, "post_action": body.post_action, "removed_posts": removed_count})
    return {"ok": True, "removed_posts": removed_count}


@router.post("/users/{user_id}/reinstate")
async def reinstate_user(user_id: str, body: ReasonIn, admin: dict = Depends(get_admin_session)):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    await db.users.update_one({"id": user_id}, {"$set": {"account_status": "Active"}})
    await db.user_suspensions.update_many({"user_id": user_id, "is_active": True}, {"$set": {"is_active": False}})
    await notify(user_id, "Account_Reinstated", f"Good news — your account has been reinstated. {body.reason}")
    await broadcaster.publish("catalog.changed", {"reason": "user_reinstated"})
    await log_admin_action(admin, "User_Reinstated", f"Reinstated {target['full_name']}. {body.reason}", target_user_id=user_id)
    return {"ok": True}


# ------------------- Permanent (hard) deletes -------------------
# These wipe records from the database entirely — not a status flag. Used when a
# post or account must disappear from the server permanently. Fully audited.

async def _purge_transactions(tx_ids: list):
    """Delete a set of transactions and every record scoped to them."""
    if not tx_ids:
        return
    flt = {"transaction_id": {"$in": tx_ids}}
    await db.transaction_state_logs.delete_many(flt)
    await db.qr_tokens.delete_many(flt)
    await db.scan_events.delete_many(flt)
    await db.lease_cycles.delete_many(flt)
    await db.user_ratings.delete_many(flt)
    await db.chat_messages.delete_many(flt)
    await db.chat_sessions.delete_many(flt)
    await db.reports.delete_many(flt)
    await db.penalties.delete_many(flt)
    await db.transactions.delete_many({"id": {"$in": tx_ids}})


@router.delete("/items/{item_id}")
async def delete_item(item_id: str, admin: dict = Depends(get_admin_session)):
    """Permanently delete a listing and everything tied to it."""
    _require_senior(admin)
    item = await db.items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")
    txs = await db.transactions.find({"item_id": item_id}).to_list(1000)
    tx_ids = [t["id"] for t in txs]
    affected = {t.get("borrower_id") for t in txs} | {t.get("lender_id") for t in txs}
    await _purge_transactions(tx_ids)
    await db.reports.delete_many({"reported_item_id": item_id})
    await db.items.delete_one({"id": item_id})
    owner_id = item.get("owner_id")
    if owner_id:
        await notify(owner_id, "Item_Removed",
                     f"Your listing '{item.get('title')}' was permanently deleted by an administrator.")
    for uid in affected:
        if uid:
            await broadcaster.publish_to([uid], "transaction.updated", {"item_id": item_id, "deleted": True})
    await broadcaster.publish("catalog.changed", {"reason": "admin_deleted_item", "item_id": item_id})
    await log_admin_action(admin, "Item_Deleted",
                           f"Permanently deleted listing '{item.get('title')}' (and {len(tx_ids)} related transactions).",
                           target_item_id=item_id, meta={"transactions": len(tx_ids)})
    return {"ok": True, "deleted_transactions": len(tx_ids)}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(get_admin_session)):
    """Permanently delete a user, their listings, and all of their activity."""
    _require_senior(admin)
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if user_id in {a["user_id"] async for a in db.admins.find({"is_active": True})}:
        raise HTTPException(status_code=400, detail="You cannot delete an administrator account.")
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")

    item_ids = [i["id"] async for i in db.items.find({"owner_id": user_id})]
    tx_ids = set()
    async for t in db.transactions.find(
            {"$or": [{"borrower_id": user_id}, {"lender_id": user_id}, {"item_id": {"$in": item_ids}}]}):
        tx_ids.add(t["id"])
    await _purge_transactions(list(tx_ids))

    await db.items.delete_many({"owner_id": user_id})
    await db.user_ratings.delete_many({"$or": [{"rater_id": user_id}, {"ratee_id": user_id}]})
    await db.reports.delete_many({"$or": [{"reporter_id": user_id}, {"reported_user_id": user_id}]})
    await db.notifications.delete_many({"recipient_user_id": user_id})
    await db.user_suspensions.delete_many({"user_id": user_id})
    await db.help_tickets.delete_many({"user_id": user_id})
    await db.penalties.delete_many({"user_id": user_id})
    await db.users.delete_one({"id": user_id})

    await broadcaster.publish("catalog.changed", {"reason": "admin_deleted_user", "user_id": user_id})
    await log_admin_action(admin, "User_Deleted",
                           f"Permanently deleted {target.get('full_name')} — {len(item_ids)} listings, {len(tx_ids)} transactions.",
                           target_user_id=user_id, meta={"items": len(item_ids), "transactions": len(tx_ids)})
    return {"ok": True, "deleted_items": len(item_ids), "deleted_transactions": len(tx_ids)}





class AdminScanIn(BaseModel):
    qr_string: str
    purpose: str
    device_info: Optional[str] = None


@router.post("/scan")
async def admin_scan(body: AdminScanIn, admin: dict = Depends(get_admin_session)):
    """On-the-spot asset check-out / check-in by an admin at a help desk.

    Same cryptographic verification as the lender scan, but an admin may action
    any transaction (university-asset authority). Fully audited.
    """
    purpose = body.purpose if body.purpose in ("Handover", "Return") else "Handover"
    ok, result, payload = parse_and_verify(body.qr_string)
    if not ok:
        msg = "This QR code is not valid." if result == "Invalid_Token" else "This QR code has expired."
        return {"success": False, "scan_result": result, "message": msg}
    tx_id = payload.get("transaction_id")
    tx = await db.transactions.find_one({"id": tx_id})
    token = await db.qr_tokens.find_one({"transaction_id": tx_id})
    if not tx or not token:
        return {"success": False, "scan_result": "Invalid_Token", "message": "Unknown transaction QR."}

    async def record(res, err=None):
        await db.scan_events.insert_one({
            "id": new_id(),
            "token_id": token["id"],
            "transaction_id": tx_id,
            "scanned_by_user_id": admin["id"],
            "scan_purpose": purpose,
            "scan_result": res,
            "device_info": body.device_info or "Admin desk",
            "error_message": err,
            "scanned_at": iso(now_utc()),
            "created_at": iso(now_utc()),
        })

    if purpose == "Handover":
        if tx["status"] == "Borrowed":
            await record("Already_Used")
            return {"success": False, "scan_result": "Already_Used", "message": "Already handed over."}
        if tx["status"] != "Approved":
            await record("State_Mismatch")
            return {"success": False, "scan_result": "State_Mismatch", "message": f"Handover not allowed for a {tx['status']} transaction."}
        await record("Success")
        await db.transactions.update_one({"id": tx_id}, {"$set": {"status": "Borrowed", "updated_at": iso(now_utc())}})
        await db.items.update_one({"id": tx["item_id"]}, {"$set": {"availability_status": "Borrowed"}})
        await db.lease_cycles.update_one({"transaction_id": tx_id}, {"$set": {
            "transaction_id": tx_id,
            "handover_timestamp": iso(now_utc()),
            "lease_status": "Active",
            "expected_return_date": tx["borrow_end_date"],
            "overdue_days": 0,
            "updated_at": iso(now_utc()),
        }, "$setOnInsert": {
            "id": new_id(),
            "handover_scan_event_id": None,
            "return_scan_event_id": None,
            "return_timestamp": None,
            "created_at": iso(now_utc()),
        }}, upsert=True)
        await log_transition(tx_id, "Approved", "Borrowed", admin["id"], "Admin desk handover scan")
        new_status = "Borrowed"
        msg = "Handover confirmed by admin."
    else:
        if tx["status"] == "Completed":
            await record("Already_Used")
            return {"success": False, "scan_result": "Already_Used", "message": "Loan already completed."}
        if tx["status"] != "Borrowed":
            await record("State_Mismatch")
            return {"success": False, "scan_result": "State_Mismatch", "message": f"Return not allowed for a {tx['status']} transaction."}
        await record("Success")
        await db.transactions.update_one({"id": tx_id}, {"$set": {"status": "Completed", "updated_at": iso(now_utc())}})
        await db.items.update_one({"id": tx["item_id"]}, {"$set": {"availability_status": "Available"}})
        await db.lease_cycles.update_one({"transaction_id": tx_id}, {"$set": {"return_timestamp": iso(now_utc()), "lease_status": "Completed", "updated_at": iso(now_utc())}}, upsert=True)
        await log_transition(tx_id, "Borrowed", "Completed", admin["id"], "Admin desk return scan")
        new_status = "Completed"
        msg = "Return confirmed by admin."

    for uid in (tx["borrower_id"], tx["lender_id"]):
        await notify(uid, "AdminAction", msg, transaction_id=tx_id)
    await broadcaster.publish("catalog.changed", {"reason": "admin_scan", "item_id": tx["item_id"]})
    await broadcaster.publish_to([tx["borrower_id"], tx["lender_id"]], "transaction.updated", {"transaction_id": tx_id, "status": new_status, "item_id": tx["item_id"]})
    await log_admin_action(admin, f"Desk_{purpose}", msg, target_transaction_id=tx_id, target_item_id=tx["item_id"])
    return {
        "success": True,
        "scan_result": "Success",
        "message": msg,
        "transaction": await enrich_transaction(await db.transactions.find_one({"id": tx_id})),
    }


@router.get("/audit")
async def audit_log(admin: dict = Depends(get_admin_session), limit: int = Query(default=100, le=1000)):
    entries = await db.admin_audit.find({}).sort("created_at", -1).to_list(limit)
    return {"entries": [clean(e) for e in entries]}
