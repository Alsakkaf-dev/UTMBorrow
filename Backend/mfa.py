"""Dependency-free TOTP (RFC 6238) for the Admin secure gateway.

Admins must pass a time-based one-time code (compatible with Google
Authenticator / Authy / 1Password) to *elevate* into the admin portal. This is
implemented with the standard library only — no extra dependency — mirroring the
project's hand-rolled `qr_engine`.

The same secret produces an `otpauth://` provisioning URI that the frontend
renders as a QR code for enrolment, and (in dev only) a live code hint so the
portal can be tested without an authenticator app.
"""
import base64
import hashlib
import hmac
import os
import secrets
import struct
import time
from urllib.parse import quote

DIGITS = 6
PERIOD = 30  # seconds
ISSUER = "UTM Borrow"


def generate_secret() -> str:
    """Return a fresh base32 TOTP secret (no padding, authenticator-friendly)."""
    return base64.b32encode(secrets.token_bytes(20)).decode("utf-8").rstrip("=")


def _hotp(secret_b32: str, counter: int) -> str:
    # base32 needs padding to a multiple of 8 chars to decode.
    pad = "=" * (-len(secret_b32) % 8)
    key = base64.b32decode(secret_b32.upper() + pad)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = (struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % (10 ** DIGITS)
    return str(code).zfill(DIGITS)


def current_code(secret_b32: str, at: float | None = None) -> str:
    """The TOTP code valid right now (used for the dev hint)."""
    counter = int((at if at is not None else time.time()) // PERIOD)
    return _hotp(secret_b32, counter)


def verify(secret_b32: str, code: str, window: int = 1) -> bool:
    """Constant-time verify a submitted code, tolerating +/- `window` steps
    for clock drift."""
    if not secret_b32 or not code:
        return False
    code = code.strip().replace(" ", "")
    if not (code.isdigit() and len(code) == DIGITS):
        return False
    now = int(time.time() // PERIOD)
    for step in range(-window, window + 1):
        if hmac.compare_digest(_hotp(secret_b32, now + step), code):
            return True
    return False


def provisioning_uri(secret_b32: str, account_name: str) -> str:
    """otpauth:// URI for QR enrolment in an authenticator app."""
    label = quote(f"{ISSUER}:{account_name}")
    params = (
        f"secret={secret_b32}&issuer={quote(ISSUER)}"
        f"&algorithm=SHA1&digits={DIGITS}&period={PERIOD}"
    )
    return f"otpauth://totp/{label}?{params}"


def dev_hint_enabled() -> bool:
    """Whether to surface the live code in API responses (DEV ONLY).

    Fail-safe: defaults OFF so a production deploy never leaks the live TOTP
    (which would collapse the admin step-up to a single factor). The local
    .env template opts in with ADMIN_MFA_DEV_HINT=1 so the portal stays
    testable without an authenticator app during development.
    """
    return os.environ.get("ADMIN_MFA_DEV_HINT", "0") == "1"
