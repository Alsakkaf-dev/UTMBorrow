"""Secure peer-to-peer chat between a borrower and a lender.

Lifecycle & rules (per product spec):
  * A connection becomes **Active** only on bidirectional acceptance — i.e. the
    borrower requested and the lender approved (tx status Approved/Borrowed).
  * Messages (text / image / file) are encrypted at rest (crypto_box) and are
    strictly isolated: only the two connected parties can read them.
  * If either party files a report, moderation may decrypt the transcript and
    grant the admin temporary read access (see /api/admin/chat/...).
"""
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from database import db, new_id, now_utc, iso, clean
from security import get_current_user, get_current_admin
from notifications import notify
from realtime import broadcaster
from routers.moderation import REPORT_CATEGORIES
import crypto_box

router = APIRouter(prefix="/api/chat", tags=["chat"])

# A connection is "live" once both sides have agreed and until the deal ends.
ACTIVE_TX = {"Approved", "Borrowed"}
CLOSED_TX = {"Completed", "Cancelled", "Rejected"}
MESSAGE_TYPES = {"text", "image", "file"}


def _state_for(tx: dict) -> str:
    s = tx.get("status")
    if s in ACTIVE_TX:
        return "Active"
    if s in CLOSED_TX:
        return "Closed"
    return "Pending"  # request placed, not yet bidirectionally accepted


async def _ensure_session(tx: dict) -> dict:
    session = await db.chat_sessions.find_one({"transaction_id": tx["id"]})
    if not session:
        session = {
            "id": new_id(),
            "transaction_id": tx["id"],
            "item_id": tx.get("item_id"),
            "borrower_id": tx["borrower_id"],
            "lender_id": tx["lender_id"],
            "state": _state_for(tx),
            "created_at": iso(now_utc()),
            "updated_at": iso(now_utc()),
        }
        await db.chat_sessions.insert_one(session)
    else:
        state = _state_for(tx)
        if state != session.get("state"):
            await db.chat_sessions.update_one(
                {"id": session["id"]}, {"$set": {"state": state, "updated_at": iso(now_utc())}})
            session["state"] = state
    return session


async def _require_party(tx_id: str, user: dict) -> dict:
    tx = await db.transactions.find_one({"id": tx_id})
    if not tx or user["id"] not in (tx["borrower_id"], tx["lender_id"]):
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return tx


def _present(msg: dict) -> dict:
    """Decrypt a stored message for an authorized reader."""
    msg = clean(msg)
    msg["body"] = crypto_box.decrypt(msg.pop("ciphertext", "")) if msg.get("kind") == "text" else None
    if msg.get("kind") in ("image", "file"):
        msg["data_url"] = crypto_box.decrypt(msg.pop("payload", ""))
    return msg


class MessageIn(BaseModel):
    kind: str = "text"
    body: Optional[str] = Field(default=None, max_length=4000)
    data_url: Optional[str] = None          # base64 data URL for image/file
    file_name: Optional[str] = Field(default=None, max_length=200)


@router.get("/by-transaction/{tx_id}")
async def get_conversation(tx_id: str, user: dict = Depends(get_current_user)):
    tx = await _require_party(tx_id, user)
    session = await _ensure_session(tx)
    msgs = await db.chat_messages.find({"session_id": session["id"]}).sort("created_at", 1).to_list(500)
    other_id = tx["lender_id"] if user["id"] == tx["borrower_id"] else tx["borrower_id"]
    other = await db.users.find_one({"id": other_id})
    return {
        "session": clean(session),
        "can_send": session["state"] == "Active",
        "messages": [_present(m) for m in msgs],
        "counterparty": {
            "id": other_id,
            "full_name": other["full_name"] if other else "Unknown",
            "profile_picture": other.get("profile_picture") if other else None,
        },
    }


@router.post("/by-transaction/{tx_id}/messages")
async def send_message(tx_id: str, body: MessageIn, user: dict = Depends(get_current_user)):
    tx = await _require_party(tx_id, user)
    session = await _ensure_session(tx)
    if session["state"] != "Active":
        raise HTTPException(status_code=403,
                            detail="Chat opens once the request is accepted by both sides.")
    if body.kind not in MESSAGE_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported message type.")

    doc = {
        "id": new_id(),
        "session_id": session["id"],
        "transaction_id": tx_id,
        "sender_id": user["id"],
        "kind": body.kind,
        "file_name": body.file_name,
        "created_at": iso(now_utc()),
        "read_at": None,          # set when the counterparty reads it (receipts)
    }
    if body.kind == "text":
        if not (body.body or "").strip():
            raise HTTPException(status_code=400, detail="Message is empty.")
        doc["ciphertext"] = crypto_box.encrypt(body.body.strip())
    else:
        if not body.data_url:
            raise HTTPException(status_code=400, detail="No file provided.")
        doc["payload"] = crypto_box.encrypt(body.data_url)

    await db.chat_messages.insert_one(doc)
    await db.chat_sessions.update_one({"id": session["id"]},
                                      {"$set": {"updated_at": iso(now_utc())}})

    presented = _present(dict(doc))
    # Live push to BOTH parties only (strict isolation — never broadcast widely).
    await broadcaster.publish_to([tx["borrower_id"], tx["lender_id"]], "chat.message",
                                 {"transaction_id": tx_id, "message": presented})
    return {"message": presented}


class ChatReportIn(BaseModel):
    # Defaults to the SDD report_category closest to harassment; validated below.
    report_category: str = "Inappropriate_Offensive"
    description: Optional[str] = Field(default=None, max_length=1000)
    incident_when: Optional[str] = None
    evidence: Optional[List[str]] = None          # base64 data-URL strings, max 3
    confirmed_truthful: bool = False


@router.post("/by-transaction/{tx_id}/report")
async def report_conversation(tx_id: str, body: ChatReportIn, user: dict = Depends(get_current_user)):
    """File a report against the counterparty in this chat.

    This both queues the report for moderation AND unlocks temporary admin
    access to decrypt this conversation's transcript for the investigation.
    """
    tx = await _require_party(tx_id, user)
    if body.report_category not in REPORT_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid report category.")
    other_id = tx["lender_id"] if user["id"] == tx["borrower_id"] else tx["borrower_id"]
    evidence = (body.evidence or [])[:3]   # cap attachments, same as item/user reports
    # Shape mirrors moderation's user-report schema so it flows through the
    # existing queue + ReportDetail UI, plus carries the transaction link that
    # unlocks transcript decryption for the reviewing admin.
    report = {
        "id": new_id(),
        "reporter_id": user["id"],
        "reported_user_id": other_id,
        "reported_item_id": f"__user__:{other_id}",
        "transaction_id": tx_id,
        "target_transaction_id": tx_id,
        "item_id": tx.get("item_id"),
        "report_category": body.report_category,
        "report_type": "Chat",
        "description": (body.description or "").strip() or None,
        "incident_when": body.incident_when or None,
        "evidence": evidence,
        "confirmed_truthful": bool(body.confirmed_truthful),
        "report_status": "Pending",
        "grants_chat_access": True,
        "submitted_at": iso(now_utc()),
        "created_at": iso(now_utc()),
    }
    await db.reports.insert_one(report)
    # Mark the session so the UI can reflect that it is under review.
    await db.chat_sessions.update_one({"transaction_id": tx_id},
                                      {"$set": {"under_review": True, "updated_at": iso(now_utc())}})
    admin_ids = [a["user_id"] async for a in db.admins.find({"is_active": True})]
    for aid in admin_ids:
        await notify(aid, "UserReported",
                     "A conversation was reported and is awaiting review.",
                     related_report_id=report["id"], transaction_id=tx_id)
    await broadcaster.publish_to(admin_ids, "moderation.changed", {"report_id": report["id"]})
    return {"ok": True, "report_id": report["id"]}


@router.post("/by-transaction/{tx_id}/read")
async def mark_read(tx_id: str, user: dict = Depends(get_current_user)):
    """Mark the counterparty's messages as read and notify them (receipts)."""
    tx = await _require_party(tx_id, user)
    session = await db.chat_sessions.find_one({"transaction_id": tx_id})
    if not session:
        return {"updated": 0}
    ts = iso(now_utc())
    result = await db.chat_messages.update_many(
        {"session_id": session["id"], "sender_id": {"$ne": user["id"]}, "read_at": None},
        {"$set": {"read_at": ts}},
    )
    if result.modified_count:
        other_id = tx["lender_id"] if user["id"] == tx["borrower_id"] else tx["borrower_id"]
        # Tell the sender their messages were seen → ticks turn to "read".
        await broadcaster.publish_to([other_id], "chat.read",
                                     {"transaction_id": tx_id, "reader_id": user["id"], "read_at": ts})
    return {"updated": result.modified_count, "read_at": ts}


@router.get("/unread-count")
async def unread(user: dict = Depends(get_current_user)):
    # Lightweight: number of active conversations the user is part of.
    sessions = await db.chat_sessions.find(
        {"$or": [{"borrower_id": user["id"]}, {"lender_id": user["id"]}], "state": "Active"}
    ).to_list(200)
    return {"active_conversations": len(sessions)}


# --------------------------- Admin (report-gated) ---------------------------

async def _report_grants_chat_access(tx_id: str) -> bool:
    """An admin may read a transcript only when a report references this deal."""
    report = await db.reports.find_one({
        "$or": [{"transaction_id": tx_id}, {"target_transaction_id": tx_id}],
    })
    return bool(report)


@router.get("/admin/by-transaction/{tx_id}")
async def admin_read_conversation(tx_id: str, admin: dict = Depends(get_current_admin)):
    tx = await db.transactions.find_one({"id": tx_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    if not await _report_grants_chat_access(tx_id):
        raise HTTPException(status_code=403,
                            detail="Transcript locked. Admin access requires an open report on this deal.")
    session = await db.chat_sessions.find_one({"transaction_id": tx_id})
    if not session:
        return {"session": None, "messages": []}
    msgs = await db.chat_messages.find({"session_id": session["id"]}).sort("created_at", 1).to_list(1000)
    return {"session": clean(session), "messages": [_present(m) for m in msgs], "decrypted_for_review": True}
