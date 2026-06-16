"""Dependency-free symmetric encryption for chat-at-rest.

Messages between two connected users are stored encrypted. The server holds the
key (env CHAT_SECRET, falling back to JWT_SECRET) so it can decrypt a transcript
**only** when moderation policy allows (a report grants temporary admin access).

Construction (no third-party deps, same HMAC-SHA256 family as qr_engine):
  * keystream = HMAC-SHA256(key, nonce || counter) in CTR mode  -> XOR plaintext
  * tag       = HMAC-SHA256(key, b"tag" || nonce || ciphertext) -> integrity
Tokens are urlsafe-base64: "v1.<nonce>.<ciphertext>.<tag>".
"""
import base64
import hashlib
import hmac
import os

_PREFIX = "v1"


def _key() -> bytes:
    secret = os.environ.get("CHAT_SECRET") or os.environ.get("JWT_SECRET", "dev-insecure-chat-secret")
    return hashlib.sha256(secret.encode("utf-8")).digest()


def _keystream(key: bytes, nonce: bytes, length: int) -> bytes:
    out = bytearray()
    counter = 0
    while len(out) < length:
        block = hmac.new(key, nonce + counter.to_bytes(8, "big"), hashlib.sha256).digest()
        out.extend(block)
        counter += 1
    return bytes(out[:length])


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64d(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def encrypt(plaintext: str) -> str:
    key = _key()
    nonce = os.urandom(16)
    data = plaintext.encode("utf-8")
    ct = bytes(a ^ b for a, b in zip(data, _keystream(key, nonce, len(data))))
    tag = hmac.new(key, b"tag" + nonce + ct, hashlib.sha256).digest()
    return ".".join([_PREFIX, _b64e(nonce), _b64e(ct), _b64e(tag)])


def decrypt(token: str) -> str:
    try:
        prefix, nonce_b, ct_b, tag_b = token.split(".")
        if prefix != _PREFIX:
            raise ValueError("bad version")
        key = _key()
        nonce, ct, tag = _b64d(nonce_b), _b64d(ct_b), _b64d(tag_b)
        expected = hmac.new(key, b"tag" + nonce + ct, hashlib.sha256).digest()

        if not hmac.compare_digest(expected, tag):
            raise ValueError("integrity check failed")
        
        data = bytes(a ^ b for a, b in zip(ct, _keystream(key, nonce, len(ct))))
        return data.decode("utf-8")
    
    except Exception:
        return "[unable to decrypt message]"
