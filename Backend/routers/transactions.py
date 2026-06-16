"""Request & Approval Workflow (spec section 5.1)."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from database import db, new_id, now_utc, iso
from security import get_current_user
from notifications import notify
from realtime import broadcaster
from tx_common import log_transition, enrich_transaction


async def _wipe_chat(tx_id: str):
    """Hard-delete chat session and messages for a transaction (privacy wipe on cancel/reject)."""
    session = await db.chat_sessions.find_one({"transaction_id": tx_id})
    if session:
        await db.chat_messages.delete_many({"session_id": session["id"]})
        await db.chat_sessions.delete_one({"id": session["id"]})

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


async def _broadcast_tx(tx: dict, status: str):
    """Push a live transaction update to both parties."""
    await broadcaster.publish_to(
        [tx.get("borrower_id"), tx.get("lender_id")],
        "transaction.updated",
        {"transaction_id": tx["id"], "status": status, "item_id": tx.get("item_id")},
    )


class RequestIn(BaseModel):
    item_id: str
    borrow_start_date: str  # YYYY-MM-DD
    borrow_end_date: str
    request_message: Optional[str] = Field(default=None, max_length=500)


class ReasonIn(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


@router.post("")
async def submit_request(body: RequestIn, user: dict = Depends(get_current_user)):
    try:
        start = date.fromisoformat(body.borrow_start_date)
        end = date.fromisoformat(body.borrow_end_date)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid dates.")
    if start < date.today():
        raise HTTPException(status_code=400, detail="Start date cannot be in the past.")
    if end <= start:
        raise HTTPException(status_code=400, detail="End date must be after the start date.")

    item = await db.items.find_one({"id": body.item_id})
    if not item or item["availability_status"] == "Removed":
        raise HTTPException(status_code=404, detail="Item not found.")
    if item["owner_id"] == user["id"]:
        raise HTTPException(status_code=400, detail="You cannot borrow your own item.")

    # Atomic concurrency lock: Available -> Pending
    locked = await db.items.find_one_and_update(
        {"id": body.item_id, "availability_status": "Available"},
        {"$set": {"availability_status": "Pending"}},
    )
    if not locked:
        raise HTTPException(status_code=409, detail="Sorry, this item was just requested by another student.")

    tx = {
        "id": new_id(), "borrower_id": user["id"], "lender_id": item["owner_id"],
        "item_id": item["id"], "request_message": (body.request_message or "").strip() or None,
        "borrow_start_date": body.borrow_start_date, "borrow_end_date": body.borrow_end_date,
        "status": "Pending", "rejection_reason": None, "cancellation_reason": None,
        "cancelled_by": None, "approval_timestamp": None,
        "created_at": iso(now_utc()), "updated_at": iso(now_utc()),
    }
    await db.transactions.insert_one(tx)
    await log_transition(tx["id"], None, "Pending", user["id"])
    await notify(item["owner_id"], "RequestReceived",
                 f"{user['full_name']} requested to borrow your '{item['title']}'.",
                 transaction_id=tx["id"])
    # Item left the catalog (Available -> Pending); update everyone's catalog.
    await broadcaster.publish("catalog.changed", {"reason": "requested", "item_id": item["id"]})
    await _broadcast_tx(tx, "Pending")
    return {"transaction": await enrich_transaction(tx)}


@router.get("/borrowing")
async def my_borrowing(user: dict = Depends(get_current_user)):
    txs = await db.transactions.find({"borrower_id": user["id"]}).sort("created_at", -1).to_list(500)
    return {"transactions": [await enrich_transaction(t) for t in txs]}


@router.get("/lending")
async def my_lending(user: dict = Depends(get_current_user)):
    txs = await db.transactions.find({"lender_id": user["id"]}).sort("created_at", -1).to_list(500)
    return {"transactions": [await enrich_transaction(t) for t in txs]}
