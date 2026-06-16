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


