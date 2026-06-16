"""QR Verification (spec section 5.2) — HMAC-SHA256 signed handover/return."""
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from database import db, new_id, now_utc, iso
from security import get_current_user
from notifications import notify
from realtime import broadcaster
from qr_engine import generate_token, parse_and_verify
from tx_common import log_transition, enrich_transaction

router = APIRouter(prefix="/api", tags=["qr"])


class ScanIn(BaseModel):
    qr_string: str
    purpose: str  # Handover | Return
    device_info: Optional[str] = None


async def _record_scan(token_id, transaction_id, scanned_by, purpose, result, error=None, device=None):
    ev = {
        "id": new_id(), "token_id": token_id, "transaction_id": transaction_id,
        "scanned_by_user_id": scanned_by, "scan_purpose": purpose, "scan_result": result,
        "device_info": device, "error_message": error,
        "scanned_at": iso(now_utc()), "created_at": iso(now_utc()),
    }
    await db.scan_events.insert_one(ev)
    return ev


@router.post("/transactions/{tx_id}/qr")
async def generate_qr(tx_id: str, user: dict = Depends(get_current_user)):
    tx = await db.transactions.find_one({"id": tx_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    if tx["borrower_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the borrower can display the QR.")
    if tx["status"] not in ("Approved", "Borrowed"):
        raise HTTPException(status_code=400, detail="QR is only available for approved or active loans.")

    existing = await db.qr_tokens.find_one({"transaction_id": tx_id})
    if existing:
        return {"qr_string": existing["qr_string"], "issued_at": existing["issued_at"],
                "expires_at": existing["expires_at"], "algorithm": existing["algorithm"]}

    qr_string, payload_b64, sig, nonce, iat, exp = generate_token(tx_id, user["id"])
    doc = {
        "id": new_id(), "transaction_id": tx_id, "borrower_id": user["id"],
        "token_payload": payload_b64, "token_hash": sig, "cryptographic_nonce": nonce,
        "algorithm": "HMAC-SHA256", "qr_string": qr_string,
        "issued_at": iso(iat), "expires_at": iso(exp), "is_revoked": False,
        "revoked_at": None, "created_at": iso(now_utc()),
    }
    await db.qr_tokens.insert_one(doc)
    return {"qr_string": qr_string, "issued_at": doc["issued_at"],
            "expires_at": doc["expires_at"], "algorithm": "HMAC-SHA256"}


@router.get("/transactions/{tx_id}/qr")
async def get_qr(tx_id: str, user: dict = Depends(get_current_user)):
    tx = await db.transactions.find_one({"id": tx_id})
    if not tx or tx["borrower_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    token = await db.qr_tokens.find_one({"transaction_id": tx_id})
    if not token:
        raise HTTPException(status_code=404, detail="No QR generated yet.")
    return {"qr_string": token["qr_string"], "issued_at": token["issued_at"],
            "expires_at": token["expires_at"], "algorithm": token["algorithm"]}


@router.post("/scan/camera-error")
async def camera_error(user: dict = Depends(get_current_user)):
    await _record_scan(None, None, user["id"], "Handover", "Camera_Error",
                       error="Camera permission denied or unavailable.")
    return {"ok": True}


@router.post("/scan")
async def scan(body: ScanIn, user: dict = Depends(get_current_user)):
    purpose = body.purpose if body.purpose in ("Handover", "Return") else "Handover"

    ok, result, payload = parse_and_verify(body.qr_string)
    if not ok:
        await _record_scan(None, None, user["id"], purpose, result, device=body.device_info)
        msg = "This QR code is not valid." if result == "Invalid_Token" else "This QR code has expired."
        return {"success": False, "scan_result": result, "message": msg}

    tx_id = payload.get("transaction_id")
    token = await db.qr_tokens.find_one({"transaction_id": tx_id})
    tx = await db.transactions.find_one({"id": tx_id})
    token_id = token["id"] if token else None

    if not token or not tx:
        await _record_scan(token_id, tx_id, user["id"], purpose, "Invalid_Token", device=body.device_info)
        return {"success": False, "scan_result": "Invalid_Token", "message": "This QR code is not valid."}

    if token.get("is_revoked"):
        await _record_scan(token_id, tx_id, user["id"], purpose, "Invalid_Token", device=body.device_info)
        return {"success": False, "scan_result": "Invalid_Token", "message": "This QR code has been revoked."}

    # The scanner must be the lender of this transaction.
    if tx["lender_id"] != user["id"]:
        await _record_scan(token_id, tx_id, user["id"], purpose, "Wrong_Transaction", device=body.device_info)
        return {"success": False, "scan_result": "Wrong_Transaction",
                "message": "This QR belongs to a transaction you are not lending."}

    # ---- Handover ----
    if purpose == "Handover":
        if tx["status"] == "Borrowed":
            await _record_scan(token_id, tx_id, user["id"], purpose, "Already_Used", device=body.device_info)
            return {"success": False, "scan_result": "Already_Used",
                    "message": "This item has already been handed over."}
        if tx["status"] != "Approved":
            await _record_scan(token_id, tx_id, user["id"], purpose, "State_Mismatch", device=body.device_info)
            return {"success": False, "scan_result": "State_Mismatch",
                    "message": f"Handover not allowed for a {tx['status']} transaction."}
        ev = await _record_scan(token_id, tx_id, user["id"], "Handover", "Success", device=body.device_info)
        await db.transactions.update_one({"id": tx_id}, {"$set": {"status": "Borrowed", "updated_at": iso(now_utc())}})
        await db.items.update_one({"id": tx["item_id"]}, {"$set": {"availability_status": "Borrowed"}})
        await db.lease_cycles.update_one(
            {"transaction_id": tx_id},
            {"$set": {"transaction_id": tx_id, "handover_scan_event_id": ev["id"],
                      "handover_timestamp": iso(now_utc()), "lease_status": "Active",
                      "expected_return_date": tx["borrow_end_date"], "overdue_days": 0,
                      "updated_at": iso(now_utc())},
             "$setOnInsert": {"id": new_id(), "return_scan_event_id": None,
                              "return_timestamp": None, "created_at": iso(now_utc())}},
            upsert=True)
        await log_transition(tx_id, "Approved", "Borrowed", user["id"], "QR handover scan")
        await notify(tx["borrower_id"], "HandoverConfirmed",
                     "Handover confirmed via QR. Enjoy! Remember to return on time.", transaction_id=tx_id)
        await broadcaster.publish_to([tx["borrower_id"], tx["lender_id"]], "transaction.updated",
                                     {"transaction_id": tx_id, "status": "Borrowed", "item_id": tx["item_id"]})
        await broadcaster.publish("item.updated", {"item_id": tx["item_id"]})
        return {"success": True, "scan_result": "Success", "message": "Handover confirmed.",
                "transaction": await enrich_transaction(await db.transactions.find_one({"id": tx_id}))}

    # ---- Return ----
    if tx["status"] == "Completed":
        await _record_scan(token_id, tx_id, user["id"], purpose, "Already_Used", device=body.device_info)
        return {"success": False, "scan_result": "Already_Used",
                "message": "This loan has already been completed."}
    if tx["status"] != "Borrowed":
        await _record_scan(token_id, tx_id, user["id"], purpose, "State_Mismatch", device=body.device_info)
        return {"success": False, "scan_result": "State_Mismatch",
                "message": f"Return not allowed for a {tx['status']} transaction."}
    ev = await _record_scan(token_id, tx_id, user["id"], "Return", "Success", device=body.device_info)
    await db.transactions.update_one({"id": tx_id}, {"$set": {"status": "Completed", "updated_at": iso(now_utc())}})
    await db.items.update_one({"id": tx["item_id"]}, {"$set": {"availability_status": "Available"}})
    await db.lease_cycles.update_one({"transaction_id": tx_id}, {"$set": {
        "return_scan_event_id": ev["id"], "return_timestamp": iso(now_utc()),
        "lease_status": "Completed", "updated_at": iso(now_utc())}}, upsert=True)
    await log_transition(tx_id, "Borrowed", "Completed", user["id"], "QR return scan")
    await notify(tx["borrower_id"], "ReturnConfirmed",
                 "Return confirmed via QR. Please rate your lender!", transaction_id=tx_id)
    await notify(tx["lender_id"], "ReturnConfirmed",
                 "Item returned. Please rate your borrower!", transaction_id=tx_id)
    # Item is back in circulation (Borrowed -> Available).
    await broadcaster.publish("catalog.changed", {"reason": "returned", "item_id": tx["item_id"]})
    await broadcaster.publish_to([tx["borrower_id"], tx["lender_id"]], "transaction.updated",
                                 {"transaction_id": tx_id, "status": "Completed", "item_id": tx["item_id"]})
    return {"success": True, "scan_result": "Success", "message": "Return confirmed.",
            "rating_prompt": True,
            "transaction": await enrich_transaction(await db.transactions.find_one({"id": tx_id}))}
