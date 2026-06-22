"""Minimal SMTP email sender (stdlib only).

Used by the password-recovery flow (SRS UC1103) to deliver a real,
time-sensitive reset link. When SMTP is not configured (local dev), email
sending is *simulated*: the function returns False and the caller surfaces the
link in-app instead, so the flow stays fully testable without a mail server.

Env vars (all optional; absence => dev/simulated mode):
  SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS,
  SMTP_FROM (default SMTP_USER), SMTP_TLS (default "1")
  FRONTEND_URL (default http://localhost:3000) — base for the reset link
"""
import os
import smtplib
import ssl
from email.message import EmailMessage


def frontend_base() -> str:
    return os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def smtp_configured() -> bool:
    return bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_USER")
                and os.environ.get("SMTP_PASS"))


def send_email(to_email: str, subject: str, body: str) -> bool:
    """Send a plain-text email. Returns True if actually dispatched via SMTP,
    False when running in simulated (no-SMTP) mode."""
    if not smtp_configured():
        print(f"[emailer] (simulated) To: {to_email}\nSubject: {subject}\n\n{body}\n")
        return False
    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ["SMTP_USER"]
    password = os.environ["SMTP_PASS"]
    sender = os.environ.get("SMTP_FROM", user)

    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    use_tls = os.environ.get("SMTP_TLS", "1") != "0"
    with smtplib.SMTP(host, port, timeout=15) as server:
        if use_tls:
            server.starttls(context=ssl.create_default_context())
        server.login(user, password)
        server.send_message(msg)
    return True


def send_password_reset(to_email: str, reset_url: str) -> bool:
    """Email a time-sensitive password reset link (UC1103)."""
    body = (
        "Hi,\n\n"
        "We received a request to reset your UTM Borrow password.\n"
        f"Use the link below within the next hour to set a new password:\n\n"
        f"{reset_url}\n\n"
        "If you did not request this, you can safely ignore this email.\n\n"
        "— UTM Borrow"
    )
    return send_email(to_email, "Reset your UTM Borrow password", body)
