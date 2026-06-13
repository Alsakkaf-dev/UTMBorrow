"""MongoDB connection and shared helpers."""
import os
import uuid
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

# Async Mongo client + database handle, read from environment variables
_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = _client[os.environ["DB_NAME"]]


def new_id() -> str:
    # Random unique id as a plain hex string (used as our own `id` field)
    return uuid.uuid4().hex


def now_utc() -> datetime:
    # Current time, timezone-aware in UTC
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    # Normalize a datetime to an ISO-8601 string; assume UTC if no tzinfo
    if dt is None:
        return None
    if isinstance(dt, str):  # already a string, pass through
        return dt
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def clean(doc: dict) -> dict:
    """Strip internal Mongo _id, leaving our own string `id` field."""
    if not doc:
        return doc
    doc = dict(doc)
    doc.pop("_id", None)
    return doc
