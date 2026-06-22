"""Auth router — register / login / recover (UTM email gated)."""
import secrets
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Response, Depends, Request
from pydantic import BaseModel, Field

from database import db, new_id, now_utc, iso, clean
from security import (
    hash_password, verify_password, create_access_token,
    is_valid_utm_email, get_current_user, ensure_account_active,
    register_session,
)
import mfa as mfa_lib
import emailer

router = APIRouter(prefix="/api/auth", tags=["auth"])

EMAIL_ERROR = "Only official UTM student emails are allowed."


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    matric_no: str = Field(min_length=2, max_length=20)
    email: str
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: str
    password: str


class ForgotIn(BaseModel):
    email: str


class ResetIn(BaseModel):
    token: str
    new_password: str = Field(min_length=6, max_length=128)


async def enrich(user: dict) -> dict:
    user = clean(user)
    user.pop("password_hash", None)
    admin = await db.admins.find_one({"user_id": user["id"], "is_active": True})
    user["is_admin"] = bool(admin)
    user["admin_role"] = admin["role"] if admin else None
    return user


def _set_cookie(response: Response, token: str):
    response.set_cookie("access_token", token, httponly=True, secure=False,
                        samesite="lax", max_age=604800, path="/")


@router.post("/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.strip().lower()
    if not is_valid_utm_email(email):
        raise HTTPException(status_code=400, detail=EMAIL_ERROR)
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    if await db.users.find_one({"matric_no": body.matric_no.strip().upper()}):
        raise HTTPException(status_code=400, detail="This matric number is already registered.")

    user = {
        "id": new_id(), "matric_no": body.matric_no.strip().upper(),
        "full_name": body.full_name.strip(), "email": email,
        "password_hash": hash_password(body.password), "profile_picture": None,
        "phone_number": None, "trust_score": 5.0, "account_status": "Active",
        "is_active": True, "created_at": iso(now_utc()),
    }
    await db.users.insert_one(user)
    jti = secrets.token_hex(16)
    token = create_access_token(user["id"], email, jti=jti)
    await register_session(user["id"], jti)
    _set_cookie(response, token)
    return {"token": token, "user": await enrich(user), "email_verified": True}


@router.post("/login")
async def login(body: LoginIn, response: Response, request: Request):
    email = body.email.strip().lower()
    if not is_valid_utm_email(email):
        raise HTTPException(status_code=400, detail=EMAIL_ERROR)
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    await ensure_account_active(user)
    jti = secrets.token_hex(16)
    token = create_access_token(user["id"], email, jti=jti)
    await register_session(user["id"], jti, request)
    _set_cookie(response, token)
    return {"token": token, "user": await enrich(user)}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    return {"user": await enrich(full)}


@router.post("/forgot-password")
async def forgot_password(body: ForgotIn):
    email = body.email.strip().lower()
    user = await db.users.find_one({"email": email})
    generic = "If that email is registered, a recovery link has been sent to your inbox."
    # Always behave the same to avoid user enumeration.
    if not user:
        return {"message": generic, "recovery_token": None, "email_sent": False}
    # Invalidate any earlier unused tokens for this user, then mint a fresh one.
    await db.password_recovery_tokens.update_many(
        {"user_id": user["id"], "used": False}, {"$set": {"used": True}})
    token = secrets.token_urlsafe(32)
    await db.password_recovery_tokens.insert_one({
        "id": new_id(), "user_id": user["id"], "recovery_token": token,
        "used": False, "expires_at": iso(now_utc() + timedelta(hours=1)),
        "created_at": iso(now_utc()),
    })
    reset_url = f"{emailer.frontend_base()}/reset?token={token}"
    sent = emailer.send_password_reset(email, reset_url)
    if sent:
        # Real email delivered — never leak the token in the response.
        return {"message": generic, "recovery_token": None, "email_sent": True}
    # Dev / no-SMTP mode: surface the token so the flow stays testable locally.
    return {
        "message": "Email delivery is not configured — use the link/token shown here (dev mode).",
        "recovery_token": token, "reset_url": reset_url, "email_sent": False,
    }


@router.post("/reset-password")
async def reset_password(body: ResetIn):
    rec = await db.password_recovery_tokens.find_one({"recovery_token": body.token})
    if not rec or rec.get("used"):
        raise HTTPException(status_code=400, detail="Invalid or already-used reset token.")
    if iso(now_utc()) > rec["expires_at"]:
        raise HTTPException(status_code=400, detail="This reset token has expired.")
    await db.users.update_one({"id": rec["user_id"]},
                              {"$set": {"password_hash": hash_password(body.new_password)}})
    await db.password_recovery_tokens.update_one({"id": rec["id"]}, {"$set": {"used": True}})
    return {"message": "Password updated. You can now log in."}


# ──────────────────────────────────────────────────────────────────
# Active Sessions
# ──────────────────────────────────────────────────────────────────

@router.get("/sessions")
async def list_sessions(user: dict = Depends(get_current_user)):
    sessions = await db.user_sessions.find(
        {"user_id": user["id"], "revoked": {"$ne": True}}
    ).sort("last_seen_at", -1).to_list(50)
    current_jti = user.get("_jti")
    out = []
    for s in sessions:
        out.append({
            "id": s["id"],
            "device_info": s.get("device_info", "Unknown device"),
            "created_at": s.get("created_at"),
            "last_seen_at": s.get("last_seen_at"),
            "is_current": s["jti"] == current_jti,
        })
    return {"sessions": out}


@router.delete("/sessions/{session_id}")
async def revoke_session(session_id: str, user: dict = Depends(get_current_user)):
    s = await db.user_sessions.find_one({"id": session_id, "user_id": user["id"]})
    if not s:
        raise HTTPException(status_code=404, detail="Session not found.")
    await db.user_sessions.update_one({"id": session_id}, {"$set": {"revoked": True}})
    return {"ok": True}


@router.post("/sessions/revoke-others")
async def revoke_other_sessions(user: dict = Depends(get_current_user)):
    current_jti = user.get("_jti")
    await db.user_sessions.update_many(
        {"user_id": user["id"], "jti": {"$ne": current_jti}, "revoked": {"$ne": True}},
        {"$set": {"revoked": True}},
    )
    return {"ok": True}


# ──────────────────────────────────────────────────────────────────
# Change Password (requires current password)
# ──────────────────────────────────────────────────────────────────

class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


@router.post("/change-password")
async def change_password(body: ChangePasswordIn, user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    if not verify_password(body.current_password, full["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    await db.users.update_one({"id": user["id"]},
                              {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"ok": True, "message": "Password updated."}


# ──────────────────────────────────────────────────────────────────
# 2FA (TOTP) — student accounts reuse the same mfa.py used for admin
# ──────────────────────────────────────────────────────────────────

class TwoFAVerifyIn(BaseModel):
    code: str
    secret: Optional[str] = None   # sent back from /2fa/setup to verify before enabling


@router.post("/2fa/setup")
async def setup_2fa(user: dict = Depends(get_current_user)):
    """Generate a fresh TOTP secret + provisioning URI (scan with authenticator app)."""
    full = await db.users.find_one({"id": user["id"]})
    if full.get("mfa_enabled"):
        raise HTTPException(status_code=400, detail="2FA is already enabled.")
    secret = mfa_lib.generate_secret()
    # Persist tentative secret; becomes active on /2fa/verify-enable
    await db.users.update_one({"id": user["id"]}, {"$set": {"mfa_pending_secret": secret}})
    uri = mfa_lib.provisioning_uri(secret, user["email"], issuer="UTM Borrow")
    return {"secret": secret, "provisioning_uri": uri}


@router.post("/2fa/verify-enable")
async def verify_enable_2fa(body: TwoFAVerifyIn, user: dict = Depends(get_current_user)):
    """Confirm the TOTP code and flip mfa_enabled=True."""
    full = await db.users.find_one({"id": user["id"]})
    secret = body.secret or full.get("mfa_pending_secret")
    if not secret:
        raise HTTPException(status_code=400, detail="Start setup first via /2fa/setup.")
    if not mfa_lib.verify(secret, body.code):
        raise HTTPException(status_code=400, detail="Invalid TOTP code. Try again.")
    await db.users.update_one({"id": user["id"]}, {
        "$set": {"mfa_enabled": True, "mfa_secret": secret},
        "$unset": {"mfa_pending_secret": ""},
    })
    return {"ok": True, "message": "Two-factor authentication is now active."}


@router.post("/2fa/disable")
async def disable_2fa(body: TwoFAVerifyIn, user: dict = Depends(get_current_user)):
    """Disable 2FA — requires a valid code to prevent lock-out attacks."""
    full = await db.users.find_one({"id": user["id"]})
    if not full.get("mfa_enabled"):
        raise HTTPException(status_code=400, detail="2FA is not enabled on this account.")
    secret = full.get("mfa_secret", "")
    if not mfa_lib.verify(secret, body.code):
        raise HTTPException(status_code=400, detail="Invalid TOTP code.")
    await db.users.update_one({"id": user["id"]}, {
        "$set": {"mfa_enabled": False},
        "$unset": {"mfa_secret": ""},
    })
    return {"ok": True, "message": "Two-factor authentication disabled."}


@router.get("/2fa/status")
async def get_2fa_status(user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    return {"mfa_enabled": bool(full.get("mfa_enabled"))}
