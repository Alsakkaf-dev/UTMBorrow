"""Community Moderation & Reporting (spec section 5.3)."""
from typing import List, Optional
from datetime import timedelta

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from database import db, new_id, now_utc, iso, clean
from security import get_current_user, get_current_admin, get_admin_session
from notifications import notify
from realtime import broadcaster

router = APIRouter(prefix="/api", tags=["moderation"])

REPORT_CATEGORIES = ["Prohibited_Illegal", "False_Scam", "Damaged_Dangerous",
                     "Inappropriate_Offensive", "False_Listing", "Other"]
# When the incident occurred (SDD Fig 3.2.3.4 / UC1203 · UC3301). Nullable.
INCIDENT_WHEN = ["Before handover", "During handover", "During the loan",
                 "At/After return", "Other"]
SUSPENSION_DAYS = {"3_Day": 3, "7_Day": 7, "30_Day": 30, "Permanent": None}

# Evidence guard (mirrors the base64 image-size pattern used for photos):
# at most 3 images, each ~3.5MB and a guarded total.
MAX_EVIDENCE_ITEMS = 3           # SDD Fig 3.2.3.4: "Max 3 files"
MAX_EVIDENCE_BYTES = 5_250_000   # ~3.5MB raw → base64 char budget per image
MAX_EVIDENCE_TOTAL = 16_000_000  # holds the full 3-file allowance (~10MB raw)


def _validate_report_extras(incident_when, evidence, confirmed_truthful):
    """Shared validation for incident time, evidence images and the
    truthfulness confirmation across item and user reports."""
    if not confirmed_truthful:
        raise HTTPException(status_code=400,
                            detail="Please confirm this report is truthful and accurate.")
    if incident_when not in (None, "", *INCIDENT_WHEN):
        raise HTTPException(status_code=400, detail="Invalid incident time.")
    ev = evidence or []
    if len(ev) > MAX_EVIDENCE_ITEMS:
        raise HTTPException(status_code=400,
                            detail=f"Attach at most {MAX_EVIDENCE_ITEMS} evidence images.")
    total = 0
    for img in ev:
        if not isinstance(img, str) or not img:
            raise HTTPException(status_code=400, detail="Invalid evidence attachment.")
        if len(img) > MAX_EVIDENCE_BYTES:
            raise HTTPException(status_code=400, detail="An evidence image is too large (max ~3.5MB).")
        total += len(img)
    if total > MAX_EVIDENCE_TOTAL:
        raise HTTPException(status_code=400, detail="Evidence attachments are too large in total.")
    return ev


class ReportIn(BaseModel):
    item_id: str
    report_category: str
    description: Optional[str] = Field(default=None, max_length=500)
    incident_when: Optional[str] = None
    evidence: Optional[List[str]] = None  # base64 data-URL strings, max 3
    confirmed_truthful: bool = False


class UserReportIn(BaseModel):
    reported_user_id: str
    report_category: str
    description: Optional[str] = Field(default=None, max_length=500)
    incident_when: Optional[str] = None
    evidence: Optional[List[str]] = None  # base64 data-URL strings, max 3
    confirmed_truthful: bool = False


def _user_report_key(user_id: str) -> str:
    # Synthetic, non-null reported_item_id so the existing unique
    # (reporter_id, reported_item_id) index dedupes one report per reported user
    # without needing a schema/index change.
    return f"__user__:{user_id}"


class DismissIn(BaseModel):
    note: Optional[str] = Field(default=None, max_length=500)


class RemoveIn(BaseModel):
    reason: str = Field(min_length=2, max_length=500)


class SuspendIn(BaseModel):
    suspension_type: str
    reason: str = Field(min_length=2, max_length=500)


# ---------------- User: report an item ----------------

@router.post("/reports")
async def report_item(body: ReportIn, user: dict = Depends(get_current_user)):
    if body.report_category not in REPORT_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid report category.")
    evidence = _validate_report_extras(body.incident_when, body.evidence, body.confirmed_truthful)
    item = await db.items.find_one({"id": body.item_id})
    if not item or item["availability_status"] == "Removed":
        raise HTTPException(status_code=404, detail="Item not found.")
    if item["owner_id"] == user["id"]:
        raise HTTPException(status_code=400, detail="You cannot report your own item.")
    if await db.reports.find_one({"reporter_id": user["id"], "reported_item_id": body.item_id}):
        raise HTTPException(status_code=400, detail="You have already reported this item.")

    report = {
        "id": new_id(), "reporter_id": user["id"], "reported_item_id": body.item_id,
        "reported_user_id": item["owner_id"], "report_category": body.report_category,
        "description": (body.description or "").strip() or None, "report_status": "Pending",
        "incident_when": body.incident_when or None, "evidence": evidence,
        "confirmed_truthful": True,
        "reviewed_by_admin_id": None, "reviewed_at": None, "dismissal_note": None,
        "submitted_at": iso(now_utc()), "created_at": iso(now_utc()), "updated_at": iso(now_utc()),
    }
    await db.reports.insert_one(report)
    await db.items.update_one({"id": body.item_id}, {"$inc": {"report_count": 1}})
    await notify(user["id"], "Report_Submitted",
                 "Your report was submitted and is under review by moderators.",
                 related_report_id=report["id"])
    # Live: nudge every active moderator's queue.
    admin_ids = [a["user_id"] async for a in db.admins.find({"is_active": True})]
    await broadcaster.publish_to(admin_ids, "moderation.changed", {"report_id": report["id"]})
    return {"report": clean(report)}


@router.post("/reports/user")
async def report_user(body: UserReportIn, user: dict = Depends(get_current_user)):
    """Report another community member (SRS UC1203). Lands in the same admin
    moderation queue; admins resolve via dismiss or suspend/ban."""
    if body.report_category not in REPORT_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid report category.")
    evidence = _validate_report_extras(body.incident_when, body.evidence, body.confirmed_truthful)
    target = await db.users.find_one({"id": body.reported_user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if target["id"] == user["id"]:
        raise HTTPException(status_code=400, detail="You cannot report yourself.")
    key = _user_report_key(target["id"])
    if await db.reports.find_one({"reporter_id": user["id"], "reported_item_id": key}):
        raise HTTPException(status_code=400, detail="You have already reported this user.")
    report = {
        "id": new_id(), "reporter_id": user["id"], "reported_item_id": key,
        "reported_user_id": target["id"], "report_category": body.report_category,
        "description": (body.description or "").strip() or None, "report_status": "Pending",
        "incident_when": body.incident_when or None, "evidence": evidence,
        "confirmed_truthful": True,
        "reviewed_by_admin_id": None, "reviewed_at": None, "dismissal_note": None,
        "submitted_at": iso(now_utc()), "created_at": iso(now_utc()), "updated_at": iso(now_utc()),
    }
    await db.reports.insert_one(report)
    await notify(user["id"], "Report_Submitted",
                 "Your report was submitted and is under review by moderators.",
                 related_report_id=report["id"])
    admin_ids = [a["user_id"] async for a in db.admins.find({"is_active": True})]
    await broadcaster.publish_to(admin_ids, "moderation.changed", {"report_id": report["id"]})
    return {"report": clean(report)}


# ---------------- Reporter: my submissions & status ----------------

@router.get("/reports/mine")
async def my_reports(user: dict = Depends(get_current_user)):
    """SRS UC1203 / UC3301 "View Submission Status": the reporter's own
    submitted reports with their current report_status and submitted_at."""
    reports = await db.reports.find({"reporter_id": user["id"]}).sort("submitted_at", -1).to_list(200)
    out = []
    for r in reports:
        is_user_report = str(r.get("reported_item_id", "")).startswith("__user__:")
        target_label = None
        if is_user_report:
            target = await db.users.find_one({"id": r.get("reported_user_id")})
            target_label = target["full_name"] if target else "a member"
        else:
            item = await db.items.find_one({"id": r.get("reported_item_id")})
            target_label = item["title"] if item else "a listing"
        out.append({
            "id": r["id"],
            "report_category": r["report_category"],
            "report_status": r.get("report_status", "Pending"),
            "incident_when": r.get("incident_when"),
            "description": r.get("description"),
            "evidence_count": len(r.get("evidence") or []),
            "is_user_report": is_user_report,
            "target_label": target_label,
            "submitted_at": r.get("submitted_at"),
        })
    return {"reports": out}


# ---------------- Admin: queue & review ----------------

async def _report_detail(report: dict) -> dict:
    report = clean(report)
    report["is_user_report"] = str(report.get("reported_item_id", "")).startswith("__user__:")
    item = None if report["is_user_report"] else await db.items.find_one({"id": report["reported_item_id"]})
    owner = await db.users.find_one({"id": report["reported_user_id"]})
    reporter = await db.users.find_one({"id": report["reporter_id"]})
    report["item"] = clean(item) if item else None
    if owner:
        owner = clean(owner)
        owner.pop("password_hash", None)
    report["owner"] = owner
    report["reporter"] = {"id": reporter["id"], "full_name": reporter["full_name"]} if reporter else None
    if owner:
        owner_txs = await db.transactions.find(
            {"$or": [{"borrower_id": owner["id"]}, {"lender_id": owner["id"]}]}
        ).sort("created_at", -1).to_list(50)
        report["owner_transaction_count"] = len(owner_txs)
    return report


@router.get("/admin/reports")
async def report_queue(admin: dict = Depends(get_current_admin)):
    reports = await db.reports.find(
        {"report_status": {"$in": ["Pending", "Under_Review"]}}
    ).sort("submitted_at", 1).to_list(200)
    pending_count = await db.reports.count_documents({"report_status": "Pending"})
    return {"reports": [await _report_detail(r) for r in reports], "pending_count": pending_count}


@router.get("/admin/reports/all")
async def all_reports(admin: dict = Depends(get_current_admin)):
    reports = await db.reports.find({}).sort("submitted_at", -1).to_list(200)
    return {"reports": [await _report_detail(r) for r in reports]}


@router.get("/admin/reports/{report_id}")
async def report_detail(report_id: str, admin: dict = Depends(get_current_admin)):
    r = await db.reports.find_one({"id": report_id})
    if not r:
        raise HTTPException(status_code=404, detail="Report not found.")
    if r["report_status"] == "Pending":
        await db.reports.update_one({"id": report_id}, {"$set": {"report_status": "Under_Review"}})
        r["report_status"] = "Under_Review"
    return {"report": await _report_detail(r)}


async def _moderation_action(report_id, admin, action_type, reason, target_item=None, target_user=None):
    action = {
        "id": new_id(), "report_id": report_id, "admin_id": admin["admin_id"],
        "action_type": action_type, "target_item_id": target_item, "target_user_id": target_user,
        "reason": reason, "created_at": iso(now_utc()),
    }
    await db.moderation_actions.insert_one(action)
    return action


@router.post("/admin/reports/{report_id}/dismiss")
async def dismiss_report(report_id: str, body: DismissIn, admin: dict = Depends(get_admin_session)):
    r = await db.reports.find_one({"id": report_id})
    if not r:
        raise HTTPException(status_code=404, detail="Report not found.")
    if r["report_status"] in ("Dismissed", "Actioned"):
        raise HTTPException(status_code=400, detail="This report was already resolved.")
    await db.reports.update_one({"id": report_id}, {"$set": {
        "report_status": "Dismissed", "reviewed_by_admin_id": admin["admin_id"],
        "reviewed_at": iso(now_utc()), "dismissal_note": (body.note or "").strip() or None,
        "updated_at": iso(now_utc())}})
    await _moderation_action(report_id, admin, "Dismiss", body.note or "No violation found.")
    await notify(r["reporter_id"], "Report_Reviewed",
                 "Your report was reviewed and dismissed by a moderator.", related_report_id=report_id)
    return {"ok": True}


@router.post("/admin/reports/{report_id}/remove-item")
async def remove_item(report_id: str, body: RemoveIn, admin: dict = Depends(get_admin_session)):
    r = await db.reports.find_one({"id": report_id})
    if not r:
        raise HTTPException(status_code=404, detail="Report not found.")
    if r["report_status"] == "Actioned":
        raise HTTPException(status_code=400, detail="This report was already actioned.")
    item = await db.items.find_one({"id": r["reported_item_id"]})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")
    await db.items.update_one({"id": item["id"]}, {"$set": {"availability_status": "Removed"}})
    await db.reports.update_one({"id": report_id}, {"$set": {
        "report_status": "Actioned", "reviewed_by_admin_id": admin["admin_id"],
        "reviewed_at": iso(now_utc()), "updated_at": iso(now_utc())}})
    await _moderation_action(report_id, admin, "Remove_Item", body.reason,
                             target_item=item["id"], target_user=item["owner_id"])
    await notify(item["owner_id"], "Item_Removed",
                 f"Your listing '{item['title']}' was removed by moderation. Reason: {body.reason}",
                 related_report_id=report_id)
    await notify(r["reporter_id"], "Report_Reviewed",
                 "Action was taken on the item you reported. Thank you.", related_report_id=report_id)
    await broadcaster.publish("catalog.changed", {"reason": "removed", "item_id": item["id"]})
    return {"ok": True}


@router.post("/admin/reports/{report_id}/suspend-user")
async def suspend_user(report_id: str, body: SuspendIn, admin: dict = Depends(get_admin_session)):
    if body.suspension_type not in SUSPENSION_DAYS:
        raise HTTPException(status_code=400, detail="Invalid suspension type.")
    r = await db.reports.find_one({"id": report_id})
    if not r:
        raise HTTPException(status_code=404, detail="Report not found.")
    if r["report_status"] == "Actioned":
        raise HTTPException(status_code=400, detail="This report was already actioned.")
    target_user = r["reported_user_id"]
    permanent = body.suspension_type == "Permanent"
    days = SUSPENSION_DAYS[body.suspension_type]
    start = now_utc()
    end = None if permanent else start + timedelta(days=days)

    await db.users.update_one({"id": target_user}, {"$set": {
        "account_status": "Banned" if permanent else "Suspended"}})
    await db.reports.update_one({"id": report_id}, {"$set": {
        "report_status": "Actioned", "reviewed_by_admin_id": admin["admin_id"],
        "reviewed_at": iso(now_utc()), "updated_at": iso(now_utc())}})
    action = await _moderation_action(
        report_id, admin, "Permanent_Ban" if permanent else "Suspend_User",
        body.reason, target_user=target_user)
    await db.user_suspensions.insert_one({
        "id": new_id(), "user_id": target_user, "action_id": action["id"],
        "suspended_by_admin_id": admin["admin_id"], "suspension_type": body.suspension_type,
        "start_at": iso(start), "end_at": iso(end) if end else None,
        "is_active": True, "reason": body.reason, "created_at": iso(now_utc()),
    })
    await notify(target_user, "Account_Suspended",
                 f"Your account has been {'permanently banned' if permanent else f'suspended ({body.suspension_type.replace(chr(95), chr(32))})'}. Reason: {body.reason}",
                 related_report_id=report_id)
    return {"ok": True}
