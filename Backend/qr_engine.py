"""The QR engine — the ONLY real cryptographic feature.

Tokens are HMAC-SHA256 signed. The QR encodes a base64(JSON) payload plus the
signature. Validation is fully server-side and constant-time.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timezone, timedelta


def _secret() -> bytes:
    return os.environ["QR_HMAC_SECRET"].encode("utf-8")


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def sign(payload_b64: str) -> str:
    return hmac.new(_secret(), payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()


def generate_token(transaction_id: str, borrower_id: str, ttl_hours: int = 24):
    """Return (qr_string, payload_b64, signature, nonce, issued_at, expires_at)."""
    nonce = secrets.token_hex(32)
    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(hours=ttl_hours)
    payload = {
        "transaction_id": transaction_id,
        "borrower_id": borrower_id,
        "nonce": nonce,
        "iat": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    payload_b64 = _b64(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = sign(payload_b64)
    qr_string = f"UTMB.{payload_b64}.{signature}"
    return qr_string, payload_b64, signature, nonce, issued_at, expires_at


def parse_and_verify(qr_string: str):
    """Verify the signature & structure of a scanned QR string.

    Returns (ok: bool, result: str, payload: dict|None).
    result is one of: Success, Invalid_Token, Expired.
    """
    try:
        if not qr_string or not qr_string.startswith("UTMB."):
            return False, "Invalid_Token", None
        parts = qr_string.split(".")
        if len(parts) != 3:
            return False, "Invalid_Token", None
        _, payload_b64, signature = parts
        expected = sign(payload_b64)
        if not hmac.compare_digest(expected, signature):
            return False, "Invalid_Token", None
        payload = json.loads(_b64decode(payload_b64).decode("utf-8"))
    except Exception:
        return False, "Invalid_Token", None

    now = int(datetime.now(timezone.utc).timestamp())
    if payload.get("exp") and now > payload["exp"]:
        return False, "Expired", payload
    return True, "Success", payload
