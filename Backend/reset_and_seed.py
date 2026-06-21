r"""Reset & seed the UTM Borrow database with a rich, realistic demo dataset.

Run from the backend directory with the project venv:

    .\.venv\Scripts\python.exe reset_and_seed.py

It WIPES every collection (all users, items + their photos, transactions, etc.)
and then inserts a complete, internally-consistent dataset that exercises every
feature, workflow, state and edge case:

  * 1 admin + 6 students, full profiles (avatar, phone, bio, campus, college).
  * 42 listings across all 6 categories / 4 conditions / multiple colleges,
    each with photo(s); a mix of Available / Pending / Borrowed / Removed and
    Public / Private visibility.
  * ~31 transactions covering Pending, Approved, Borrowed (active), Overdue,
    Completed (returned) and Rejected / Cancelled — every borrower has >=3
    borrow requests against other users' items.
  * QR tokens, scan events, lease cycles, mutual ratings (incl. outstanding
    "pending rating" actions), notifications, saved items, encrypted chat,
    reports (with incident time + evidence + truthfulness), moderation actions,
    help tickets, penalties, a suspension lifecycle and an admin audit trail.

All ids are uuid4().hex strings; timestamps are ISO-8601 UTC — matching the
app's database.py conventions exactly. Mongo's _id is never used as a key.
"""
import base64
import random
import struct
import uuid
import zlib
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import bcrypt
from dotenv import load_dotenv

load_dotenv()

import os
from pymongo import MongoClient

import qr_engine
import crypto_box

client = MongoClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

random.seed(2026)

# ---------------------------------------------------------------- helpers ----

def new_id() -> str:
    return uuid.uuid4().hex


def iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


NOW = datetime.now(timezone.utc)
TODAY = NOW.date()


def days_ago(n, hour=10):
    return (NOW - timedelta(days=n)).replace(hour=hour % 24, minute=random.randint(0, 59), second=0, microsecond=0)


def date_offset(n_days):
    """A YYYY-MM-DD string n_days from today (negative = past)."""
    return (TODAY + timedelta(days=n_days)).isoformat()


PASSWORD_HASH = bcrypt.hashpw("Test1234".encode(), bcrypt.gensalt()).decode()


def avatar(name, color):
    return f"https://ui-avatars.com/api/?name={quote(name)}&size=256&background={color}&color=ffffff&bold=true&format=png"


def item_photos(slug, n=3):
    base = slug.lower().replace(" ", "-").replace("/", "-").replace("&", "and")
    return [f"https://picsum.photos/seed/utmb-{base}-{i}/640/480" for i in range(1, n + 1)]


def _png_chunk(tag, data):
    return (struct.pack(">I", len(data)) + tag + data +
            struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))


def solid_png_data_url(rgb, size=64):
    """A tiny self-contained solid-colour PNG as a base64 data URL (report evidence)."""
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit truecolour RGB
    row = b"\x00" + bytes(rgb) * size
    raw = row * size
    idat = zlib.compress(raw, 9)
    png = sig + _png_chunk(b"IHDR", ihdr) + _png_chunk(b"IDAT", idat) + _png_chunk(b"IEND", b"")
    return "data:image/png;base64," + base64.b64encode(png).decode()


EVIDENCE_RED = solid_png_data_url((201, 64, 64))
EVIDENCE_AMBER = solid_png_data_url((214, 158, 46))
EVIDENCE_SLATE = solid_png_data_url((71, 85, 105))

