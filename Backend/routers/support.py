"""Help desk, admin notification center, and fraud detection.

  * "Get Help" lets any user open a support ticket; admins are notified in
    real time and a direct support conversation can begin.
  * The admin notification center surfaces user complaints (reports) + system
    flags (fraud heuristics) in one inbox.
  * Fraud detection runs lightweight, explainable heuristics over the data to
    flag possible cheating / theft / unauthorized activity for human review.
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from database import db, new_id, now_utc, iso, clean
from security import get_current_user, get_current_admin
from notifications import notify
from realtime import broadcaster

router = APIRouter(prefix="/api", tags=["support"])


class HelpIn(BaseModel):
    subject: str = Field(min_length=2, max_length=150)
    message: str = Field(min_length=2, max_length=2000)
    transaction_id: Optional[str] = None


@router.post("/help")
async def get_help(body: HelpIn, user: dict = Depends(get_current_user)):
    """User invokes 'Get Help' — opens a ticket and pings admins live."""
    ticket = {
        "id": new_id(),
        "user_id": user["id"],
        "user_name": user["full_name"],
        "subject": body.subject.strip(),
        "message": body.message.strip(),
        "transaction_id": body.transaction_id,
        "status": "Open",
        "created_at": iso(now_utc()),
        "updated_at": iso(now_utc()),
    }
    await db.help_tickets.insert_one(ticket)
    admin_ids = [a["user_id"] async for a in db.admins.find({"is_active": True})]
    for aid in admin_ids:
        await notify(aid, "UserReported", f"New help request: {ticket['subject']}",
                     transaction_id=body.transaction_id)
    # Real-time visibility + a channel the admin can open immediately.
    await broadcaster.publish_to(admin_ids, "moderation.changed",
                                 {"help_ticket_id": ticket["id"], "kind": "help"})
    return {"ok": True, "ticket": clean(ticket)}


@router.get("/help/mine")
async def my_tickets(user: dict = Depends(get_current_user)):
    tickets = await db.help_tickets.find({"user_id": user["id"]}).sort("created_at", -1).to_list(100)
    return {"tickets": [clean(t) for t in tickets]}


# ------------------------------ Admin inbox ------------------------------

@router.get("/admin/alerts")
async def admin_alerts(admin: dict = Depends(get_current_admin)):
    """Unified notification center: open complaints + help tickets + flags."""
    reports = await db.reports.find({"report_status": {"$in": ["Pending", "Under_Review"]}}
                                    ).sort("submitted_at", -1).to_list(100)
    tickets = await db.help_tickets.find({"status": "Open"}).sort("created_at", -1).to_list(100)
    flags = await _fraud_flags()
    return {
        "complaints": [clean(r) for r in reports],
        "help_tickets": [clean(t) for t in tickets],
        "system_flags": flags,
        "counts": {"complaints": len(reports), "help": len(tickets), "flags": len(flags)},
    }


@router.get("/admin/help")
async def admin_help(admin: dict = Depends(get_current_admin)):
    tickets = await db.help_tickets.find({}).sort("created_at", -1).to_list(200)
    return {"tickets": [clean(t) for t in tickets]}


@router.post("/admin/help/{ticket_id}/resolve")
async def resolve_ticket(ticket_id: str, admin: dict = Depends(get_current_admin)):
    t = await db.help_tickets.find_one({"id": ticket_id})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    await db.help_tickets.update_one({"id": ticket_id},
                                     {"$set": {"status": "Resolved", "updated_at": iso(now_utc())}})
    await notify(t["user_id"], "AdminAction", "An administrator resolved your help request.")
    return {"ok": True}


# --------------------------- Fraud detection ----------------------------

async def _fraud_flags():
    """Explainable heuristics over recent data. Each flag is a review prompt."""
    flags = []

    # 1) Repeatedly reported users (>= 2 distinct reports).
    pipeline = [{"$group": {"_id": "$reported_user_id", "n": {"$sum": 1}}},
                {"$match": {"n": {"$gte": 2}}}]
    async for row in db.reports.aggregate(pipeline):
        uid = row["_id"]
        if not uid:
            continue
        u = await db.users.find_one({"id": uid})
        flags.append({
            "kind": "Repeatedly_Reported", "severity": "high",
            "user_id": uid, "user_name": u["full_name"] if u else "Unknown",
            "detail": f"Subject of {row['n']} reports.",
        })

    # 2) Overdue active loans (possible theft / non-return).
    async for lease in db.lease_cycles.find({"lease_status": "Active"}).to_list(500):
        exp = lease.get("expected_return_date")
        if exp and iso(now_utc())[:10] > str(exp)[:10]:
            tx = await db.transactions.find_one({"id": lease.get("transaction_id")})
            if tx and tx.get("status") == "Borrowed":
                flags.append({
                    "kind": "Overdue_Possible_Theft", "severity": "high",
                    "user_id": tx.get("borrower_id"), "transaction_id": tx["id"],
                    "detail": f"Item overdue since {str(exp)[:10]} and not returned.",
                })

    # 3) Frequent cancellations (>= 3 cancelled deals as a party).
    cancels = {}
    async for tx in db.transactions.find({"status": "Cancelled"}).to_list(1000):
        for uid in (tx.get("borrower_id"), tx.get("lender_id")):
            cancels[uid] = cancels.get(uid, 0) + 1
    for uid, n in cancels.items():
        if uid and n >= 3:
            u = await db.users.find_one({"id": uid})
            flags.append({
                "kind": "Frequent_Cancellations", "severity": "medium",
                "user_id": uid, "user_name": u["full_name"] if u else "Unknown",
                "detail": f"Involved in {n} cancelled transactions.",
            })

    # 4) Critically low trust score.
    async for u in db.users.find({"trust_score": {"$lt": 2.5}}).to_list(200):
        flags.append({
            "kind": "Low_Trust_Score", "severity": "medium",
            "user_id": u["id"], "user_name": u["full_name"],
            "detail": f"Trust score {round(float(u.get('trust_score', 0)), 2)} (below 2.5).",
        })

    return flags


@router.get("/admin/fraud")
async def admin_fraud(admin: dict = Depends(get_current_admin)):
    flags = await _fraud_flags()
    return {"flags": flags, "count": len(flags)}


# ------------------------ Admin full-CRUD: items ------------------------

class RemoveItemIn(BaseModel):
    reason: str = Field(min_length=2, max_length=500)


@router.post("/admin/items/{item_id}/remove")
async def admin_remove_item(item_id: str, body: RemoveItemIn, admin: dict = Depends(get_current_admin)):
    """Hard moderation removal of any listing (full-CRUD admin authority)."""
    item = await db.items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")
    await db.items.update_one({"id": item_id}, {"$set": {
        "availability_status": "Removed", "removed_reason": body.reason,
        "removed_by_admin_id": admin.get("admin_id"), "updated_at": iso(now_utc())}})
    # Cancel any in-flight transaction tied to the item.
    async for tx in db.transactions.find(
            {"item_id": item_id, "status": {"$in": ["Pending", "Approved"]}}).to_list(50):
        await db.transactions.update_one({"id": tx["id"]}, {"$set": {
            "status": "Cancelled", "cancellation_reason": "Item removed by admin.",
            "cancelled_by": "Admin", "updated_at": iso(now_utc())}})
        await broadcaster.publish_to([tx["borrower_id"], tx["lender_id"]], "transaction.updated",
                                     {"transaction_id": tx["id"], "status": "Cancelled", "item_id": item_id})
    await notify(item["owner_id"], "Item_Removed",
                 f"Your listing '{item.get('title')}' was removed by an administrator. Reason: {body.reason}")
    await broadcaster.publish("catalog.changed", {"reason": "admin_removed_item", "item_id": item_id})
    return {"ok": True}
