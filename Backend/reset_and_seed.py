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
# ============================================================================
#  Imports & configuration
# ============================================================================

# Standard library
import base64
import random
import struct
import uuid
import zlib
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

# Third-party
import bcrypt
from dotenv import load_dotenv

# Load the .env file BEFORE importing local modules that read env vars on import.
load_dotenv()

import os
from pymongo import MongoClient

# Local modules
import qr_engine
import crypto_box

# Database connection + deterministic RNG seed (stable demo data on every run).
client = MongoClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

random.seed(2026)

# ============================================================================
#  Helpers — ids, timestamps, passwords, and asset/photo generators
# ============================================================================

# --- Identifiers & timestamps ---

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


# --- Profile pictures & item photos ---

def avatar(name, color):
    return f"https://ui-avatars.com/api/?name={quote(name)}&size=256&background={color}&color=ffffff&bold=true&format=png"


def item_photos(slug, n=3):
    base = slug.lower().replace(" ", "-").replace("/", "-").replace("&", "and")
    return [f"https://picsum.photos/seed/utmb-{base}-{i}/640/480" for i in range(1, n + 1)]


# --- Solid-colour PNG evidence images ---

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

# ============================================================================
#  Wipe — clear every collection before re-seeding
# ============================================================================

COLLECTIONS = [
    "users", "admins", "items", "transactions", "transaction_state_logs",
    "qr_tokens", "scan_events", "lease_cycles", "user_ratings", "notifications",
    "reports", "moderation_actions", "user_suspensions", "penalties",
    "admin_audit", "help_tickets", "saved_items", "chat_sessions",
    "chat_messages", "password_recovery_tokens", "user_sessions",
]


def wipe():
    for c in COLLECTIONS:
        db[c].delete_many({})
    print("Wiped:", ", ".join(COLLECTIONS))


# ============================================================================
#  Users — 6 students + 1 admin moderator
# ============================================================================

USERS_DEF = [
    # full_name, matric_no, email, phone, college, faculty, campus, bio, avatar_color
    ("Aisha Rahman", "A22CS1001", "aisha.rahman@graduate.utm.my", "+60 12-345 6701",
     "Kolej Tuanku Canselor", "Computing", "Skudai",
     "Final-year Computer Science student who loves building IoT gadgets. Happy to share my lab kit and books with fellow students.", "1E3A8A"),
    ("Daniel Tan", "A22EE1002", "daniel.tan@graduate.utm.my", "+60 13-222 8802",
     "Kolej 9", "Engineering", "Skudai",
     "Mechanical engineering. I lend out tools and measuring instruments — just take care of them and return on time!", "0F766E"),
    ("Priya Nair", "A21SC1003", "priya.nair@graduate.utm.my", "+60 11-987 6543",
     "Kolej Perdana", "Science", "Skudai",
     "Chemistry postgrad and lab demonstrator. Lab coats, goggles and reference texts always available to borrow.", "9333EA"),
    ("Hafiz Zulkifli", "A23BE1004", "hafiz.zulkifli@graduate.utm.my", "+60 19-444 1205",
     "Kolej Rahman Putra", "Built Environment", "Pagoh",
     "Architecture student based in Pagoh. Drafting tools and presentation gear ready whenever you need them.", "B45309"),
    ("Mei Ling Wong", "A22CS1005", "meiling.wong@graduate.utm.my", "+60 16-770 9981",
     "Kolej 9", "Computing", "Skudai",
     "Frontend developer & campus photographer. Cameras, tablets and CS textbooks up for grabs.", "BE123C"),
    ("Arjun Kumar", "A24EE1006", "arjun.kumar@graduate.utm.my", "+60 17-308 4420",
     "Kolej Tuanku Canselor", "Engineering", "Kuala Lumpur",
     "First-year engineering student still building my reputation on the platform — be patient with me!", "475569"),
]

ADMIN_DEF = ("Nurul Hidayah", "STAFF100", "admin@utm.my", "+60 12-000 0000",
             "Senior_Moderator", "1F2937")


# --- Build the 6 student records ---
users = []          # 6 students
for (name, matric, email, phone, college, faculty, campus, bio, color) in USERS_DEF:
    users.append({
        "id": new_id(), "matric_no": matric, "full_name": name, "email": email,
        "password_hash": PASSWORD_HASH, "profile_picture": avatar(name, color),
        "phone_number": phone, "bio": bio, "campus": campus,
        "location_college": college, "location_faculty": faculty,
        "trust_score": 5.0,  # recomputed from ratings below
        "account_status": "Active", "is_active": True,
        "mfa_enabled": False,
        "created_at": iso(days_ago(random.randint(120, 320))),
    })


# --- Build the admin moderator records ---
admin_user = {
    "id": new_id(), "matric_no": ADMIN_DEF[1], "full_name": ADMIN_DEF[0],
    "email": ADMIN_DEF[2], "password_hash": PASSWORD_HASH,
    "profile_picture": avatar(ADMIN_DEF[0], ADMIN_DEF[5]), "phone_number": ADMIN_DEF[3],
    "bio": "Platform moderator. I review reports and keep the UTM Borrow community safe.",
    "campus": "Skudai", "location_college": "Other", "location_faculty": "Other",
    "trust_score": 5.0, "account_status": "Active", "is_active": True,
    "mfa_enabled": False, "created_at": iso(days_ago(400)),
}

U = [u["id"] for u in users]          # student ids by index 0..5
ADMIN_UID = admin_user["id"]

admin_record = {
    "id": new_id(), "user_id": ADMIN_UID, "role": "Senior_Moderator",
    "is_active": True, "granted_by_admin_id": None,
    "granted_at": iso(days_ago(400)), "revoked_at": None,
    "alert_prefs": {"email": True, "sms": False},
}
ADMIN_ID = admin_record["id"]

# ============================================================================
#  Items — 42 listings across all categories, conditions and colleges
# ============================================================================
# (owner_idx, title, category, condition, [college_override], [faculty_override])
ITEMS_DEF = [
    # Owner 0 — Aisha (Computing)
    (0, "Casio fx-991EX Scientific Calculator", "Electronics", "Good"),
    (0, "Raspberry Pi 4 Model B Starter Kit", "Electronics", "Like New"),
    (0, "\"Clean Code\" by Robert C. Martin", "Textbooks", "Good"),
    (0, "Logitech Wireless Mouse", "Electronics", "Fair"),
    (0, "USB-C Hub & Adapter Set", "Electronics", "Like New"),
    (0, "Sony Noise-Cancelling Headphones", "Electronics", "Good"),
    (0, "Portable SSD 1TB", "Electronics", "Like New"),
    # Owner 1 — Daniel (Engineering)
    (1, "Digital Vernier Caliper", "Tools", "Good"),
    (1, "Cordless Power Drill", "Tools", "Good"),
    (1, "Soldering Iron Station", "Tools", "Fair"),
    (1, "Engineering Mechanics Textbook (Hibbeler)", "Textbooks", "Good"),
    (1, "Safety Helmet (Hard Hat)", "Lab Equipment", "Like New"),
    (1, "Digital Multimeter", "Electronics", "Good"),
    (1, "Allen Keys & Screwdriver Set", "Tools", "Fair"),
    # Owner 2 — Priya (Science)
    (2, "White Lab Coat (Size M)", "Lab Equipment", "Like New"),
    (2, "Anti-Fog Safety Goggles", "Lab Equipment", "Good"),
    (2, "Organic Chemistry Textbook (Clayden)", "Textbooks", "Good"),
    (2, "Digital Lab Timer", "Lab Equipment", "Like New"),
    (2, "Glassware Cleaning Brush Set", "Lab Equipment", "Fair", "Other", None),
    (2, "Hardcover Lab Notebook", "Textbooks", "Like New"),
    (2, "Microscope Slide Storage Box", "Lab Equipment", "Good"),
    # Owner 3 — Hafiz (Built Environment)
    (3, "Engineering Drawing & Drafting Set", "Tools", "Good"),
    (3, "A2 Drawing Board with Parallel Ruler", "Tools", "Good"),
    (3, "Architectural Scale Ruler", "Tools", "Like New"),
    (3, "Formal Navy Blazer (Size L)", "Clothing", "Fair"),
    (3, "Model-Making Cutting Kit", "Tools", "Good"),
    (3, "Site Visit Safety Vest", "Lab Equipment", "Good"),
    (3, "Presentation Pointer & Clicker", "Electronics", "Like New"),
    # Owner 4 — Mei Ling (Computing / media)
    (4, "Canon EOS M50 Mirrorless Camera", "Electronics", "Good"),
    (4, "Wacom Intuos Graphic Tablet", "Electronics", "Fair"),
    (4, "\"Introduction to Algorithms\" (CLRS)", "Textbooks", "Good"),
    (4, "Ring Light with Tripod Stand", "Electronics", "Like New"),
    (4, "Mechanical Keyboard (RGB)", "Electronics", "Good"),
    (4, "Graduation Robe & Cap", "Clothing", "Like New"),
    (4, "Mini Portable Projector", "Electronics", "Fair"),
    # Owner 5 — Arjun (Engineering, newcomer)
    (5, "Arduino Uno Starter Kit", "Electronics", "Like New"),
    (5, "Breadboard & Jumper Wire Set", "Electronics", "Good"),
    (5, "Engineering Graph Paper Pad", "Textbooks", "Like New", "Other", "Other"),
    (5, "Basic Hand Tool Box", "Tools", "Fair"),
    (5, "Reflective Rain Jacket", "Clothing", "Good"),
    (5, "Scientific Poster Carry Tube", "Other", "Like New"),
    (5, "Adjustable LED Desk Lamp", "Electronics", "Good"),
]

# --- Per-item marketing descriptions (keyed by exact item title) ---
DESCRIPTIONS = {
    "Casio fx-991EX Scientific Calculator": "Casio fx-991EX ClassWiz, 552 functions — perfect for engineering and statistics. Fully working with cover.",
    "Raspberry Pi 4 Model B Starter Kit": "Raspberry Pi 4 (4GB) with case, power supply, micro-HDMI cable and 32GB SD card pre-loaded with Raspberry Pi OS.",
    "\"Clean Code\" by Robert C. Martin": "Classic software craftsmanship book. A few highlights inside but otherwise in great shape.",
    "Logitech Wireless Mouse": "Reliable 2.4GHz wireless mouse with USB receiver. Some scuffs but tracks perfectly.",
    "USB-C Hub & Adapter Set": "7-in-1 USB-C hub: HDMI, USB-A x3, SD/microSD, PD charging. Great for thin laptops.",
    "Sony Noise-Cancelling Headphones": "Over-ear ANC headphones, excellent for the library. Comes with carry pouch and cable.",
    "Portable SSD 1TB": "Pocket-sized 1TB USB-C SSD, very fast. Ideal for backing up project files before submission.",
    "Digital Vernier Caliper": "0-150mm digital caliper, 0.01mm resolution. Calibrated and accurate.",
    "Cordless Power Drill": "18V cordless drill with two batteries, charger and a basic bit set.",
    "Soldering Iron Station": "Adjustable-temperature soldering station with stand and spare tips. Light wear from lab use.",
    "Engineering Mechanics Textbook (Hibbeler)": "Hibbeler Statics & Dynamics. Standard reference for mechanical/civil students.",
    "Safety Helmet (Hard Hat)": "Brand-new industrial hard hat, adjustable. Never used on site.",
    "Digital Multimeter": "Auto-ranging digital multimeter with probes. Measures voltage, current, resistance and continuity.",
    "Allen Keys & Screwdriver Set": "Mixed metric/imperial hex keys plus precision screwdrivers in a roll-up pouch.",
    "White Lab Coat (Size M)": "Freshly laundered 100% cotton lab coat, size M. Compliant for chemistry labs.",
    "Anti-Fog Safety Goggles": "Sealed splash goggles with anti-fog coating. Sanitised after every loan.",
    "Organic Chemistry Textbook (Clayden)": "Clayden Organic Chemistry, 2nd edition. Lightly used, no missing pages.",
    "Digital Lab Timer": "Triple-channel countdown/up lab timer with loud alarm and magnetic back.",
    "Glassware Cleaning Brush Set": "Assorted test-tube and flask brushes. Functional, some bristle wear.",
    "Hardcover Lab Notebook": "200-page hardbound lab notebook with numbered pages. Brand new, never written in.",
    "Microscope Slide Storage Box": "Holds 100 microscope slides, hinged lid with index card.",
    "Engineering Drawing & Drafting Set": "Complete drafting set: compass, dividers, set squares, protractor and rulers.",
    "A2 Drawing Board with Parallel Ruler": "Portable A2 drawing board with a smooth parallel-motion ruler. Great for technical drawing.",
    "Architectural Scale Ruler": "Triangular aluminium scale ruler with common architectural and engineering scales.",
    "Formal Navy Blazer (Size L)": "Navy formal blazer for presentations and viva, size L. Dry-cleaned; minor wear on cuffs.",
    "Model-Making Cutting Kit": "Self-healing cutting mat, steel ruler and a set of craft knives for architecture models.",
    "Site Visit Safety Vest": "High-visibility safety vest for site visits. One size fits most.",
    "Presentation Pointer & Clicker": "Wireless presenter with laser pointer and USB receiver. Slide forward/back and blank-screen.",
    "Canon EOS M50 Mirrorless Camera": "Canon EOS M50 with 15-45mm kit lens, battery, charger and a 32GB card. Great for events.",
    "Wacom Intuos Graphic Tablet": "Wacom Intuos pen tablet with pen and spare nibs. Some surface scratches but fully functional.",
    "\"Introduction to Algorithms\" (CLRS)": "The classic CLRS algorithms textbook. Heavily referenced but intact.",
    "Ring Light with Tripod Stand": "10-inch LED ring light with adjustable tripod and phone holder. Three colour temperatures.",
    "Mechanical Keyboard (RGB)": "Compact RGB mechanical keyboard with brown switches. Quiet enough for shared spaces.",
    "Graduation Robe & Cap": "UTM graduation robe and mortarboard, freshly pressed. Return after your photoshoot!",
    "Mini Portable Projector": "Compact LED projector, HDMI/USB, up to 100-inch image. Best in a dim room.",
    "Arduino Uno Starter Kit": "Arduino Uno R3 with breadboard, sensors, LEDs, resistors and jumper wires. Beginner friendly.",
    "Breadboard & Jumper Wire Set": "Two full-size breadboards plus a big pack of male/male jumper wires.",
    "Engineering Graph Paper Pad": "A4 engineering graph/log paper pad, mostly unused.",
    "Basic Hand Tool Box": "Compact tool box: hammer, pliers, screwdrivers, tape measure and utility knife.",
    "Reflective Rain Jacket": "Lightweight waterproof jacket with reflective strips for rainy commutes.",
    "Scientific Poster Carry Tube": "Hard plastic poster tube with shoulder strap — protects A1 posters for conferences.",
    "Adjustable LED Desk Lamp": "Dimmable LED desk lamp with adjustable arm and USB charging port.",
}

# ============================================================================
#  Build item records (+ private-listing overrides)
# ============================================================================

OWNER_COLLEGE = [u["location_college"] for u in users]
OWNER_FACULTY = [u["location_faculty"] for u in users]

items = []
owner_items = {i: [] for i in range(6)}   # owner_idx -> [item dict,...] in catalog order
for entry in ITEMS_DEF:
    owner_idx, title, cat, cond = entry[0], entry[1], entry[2], entry[3]
    college = entry[4] if len(entry) > 4 and entry[4] else OWNER_COLLEGE[owner_idx]
    faculty = entry[5] if len(entry) > 5 else OWNER_FACULTY[owner_idx]
    photos = item_photos(title)
    created = days_ago(random.randint(15, 110))
    it = {
        "id": new_id(), "owner_id": U[owner_idx], "title": title,
        "description": DESCRIPTIONS[title], "category": cat, "condition": cond,
        "location_college": college, "location_faculty": faculty,
        "photo_url": photos[0], "photo_urls": photos,
        "availability_status": "Available", "visibility": "Public",
        "report_count": 0, "created_at": iso(created), "last_refreshed_at": iso(created),
    }
    items.append(it)
    owner_items[owner_idx].append(it)


def item_of(owner_idx, idx):
    return owner_items[owner_idx][idx]


# Private listings (still owned/visible to owner, hidden from catalog).
item_of(4, 1)["visibility"] = "Private"   # Wacom Tablet
item_of(3, 3)["visibility"] = "Private"   # Navy Blazer

# ============================================================================
#  Transactions — borrow requests across every lifecycle state
# ============================================================================
ACTIVE_STATES = {"Pending", "Approved", "Borrowed"}

# spec: code, borrower_idx, (owner_idx,item_idx), state, kw
#   kw may include: overdue (days), cancelled_by, reason, msg, created_days_ago
TX_SPECS = [
    # Completed (returned)
    ("C1", 2, (0, 2), "Completed", dict(created_days_ago=24, dur=6, msg="Borrowing this for my software design module — thanks!")),
    ("C2", 0, (1, 0), "Completed", dict(created_days_ago=21, dur=4, msg="Need a precise caliper for my measurement lab.")),
    ("C3", 4, (2, 2), "Completed", dict(created_days_ago=19, dur=7, msg="Studying for the organic chemistry final.")),
    ("C4", 1, (4, 2), "Completed", dict(created_days_ago=17, dur=8, msg="Algorithms revision before the exam.")),
    ("C5", 3, (0, 5), "Completed", dict(created_days_ago=15, dur=5, msg="Long library sessions this week — these will help.")),
    ("C6", 0, (5, 0), "Completed", dict(created_days_ago=13, dur=6, msg="Prototyping a small IoT demo.")),
    ("C7", 2, (5, 1), "Completed", dict(created_days_ago=12, dur=5, msg="Need breadboards for a circuits assignment.")),
    ("C8", 4, (3, 2), "Completed", dict(created_days_ago=10, dur=4, msg="Drafting some quick floor plans.")),
    # Borrowed (active, on time)
    ("B1", 3, (1, 1), "Borrowed", dict(created_days_ago=4, dur=6, msg="Putting up some shelves in studio.")),
    ("B2", 5, (4, 3), "Borrowed", dict(created_days_ago=3, dur=7, msg="Recording a project demo video.")),
    ("B3", 1, (2, 0), "Borrowed", dict(created_days_ago=5, dur=8, msg="Have a wet lab this week.")),
    ("B4", 4, (0, 1), "Borrowed", dict(created_days_ago=2, dur=5, msg="Trying out a home automation idea.")),
    # Overdue (active, past due) — drives admin oversight + fraud flags
    ("O1", 5, (1, 2), "Overdue", dict(created_days_ago=12, overdue=5, dur=4, msg="Soldering a PCB for my project.")),
    ("O2", 0, (3, 1), "Overdue", dict(created_days_ago=9, overdue=2, dur=5, msg="Working on technical drawings.")),
    ("O3", 2, (4, 0), "Overdue", dict(created_days_ago=16, overdue=8, dur=6, msg="Shooting photos for the science fair.")),
    # Approved (QR issued, awaiting handover)
    ("A1", 1, (0, 4), "Approved", dict(created_days_ago=2, dur=4, msg="Need extra ports for a presentation.")),
    ("A2", 3, (2, 1), "Approved", dict(created_days_ago=1, dur=3, msg="Site model spray-painting — need eye protection.")),
    ("A3", 5, (3, 4), "Approved", dict(created_days_ago=1, dur=5, msg="Building an architecture model.")),
    ("A4", 4, (1, 5), "Approved", dict(created_days_ago=2, dur=4, msg="Debugging a power supply circuit.")),
    # Pending (awaiting lender decision)
    ("P1", 0, (2, 3), "Pending", dict(created_days_ago=1, dur=3, msg="Timing reactions in the lab tomorrow.")),
    ("P2", 2, (1, 4), "Pending", dict(created_days_ago=0, dur=2, msg="Quick site visit, need a hard hat.")),
    ("P3", 3, (4, 4), "Pending", dict(created_days_ago=1, dur=6, msg="My keyboard broke before finals!")),
    ("P4", 4, (5, 3), "Pending", dict(created_days_ago=0, dur=3, msg="Assembling some flat-pack furniture.")),
    ("P5", 5, (0, 6), "Pending", dict(created_days_ago=0, dur=4, msg="Backing up my final-year project.")),
    # Rejected
    ("R1", 5, (2, 5), "Rejected", dict(created_days_ago=14, dur=5, msg="Need a notebook for my experiments.",
                                       reason="Sorry, I already promised this to a labmate this week.")),
    ("R2", 0, (4, 6), "Rejected", dict(created_days_ago=11, dur=3, msg="Movie night for my floor!",
                                       reason="I need the projector myself this weekend.")),
    ("R3", 3, (1, 6), "Rejected", dict(created_days_ago=8, dur=4, msg="Assembling some furniture.",
                                       reason="The set is incomplete right now, sorry.")),
    ("R4", 2, (0, 3), "Rejected", dict(created_days_ago=7, dur=5, msg="My mouse died.",
                                       reason="Just lent it to someone else, try again next week.")),
    # Cancelled (3 involving Daniel -> Frequent_Cancellations flag)
    ("X1", 1, (3, 5), "Cancelled", dict(created_days_ago=13, dur=2, cancelled_by="Borrower",
                                        msg="Need a vest for a site visit.",
                                        reason="The site visit got postponed, no longer needed.")),
    ("X2", 1, (5, 2), "Cancelled", dict(created_days_ago=9, dur=3, cancelled_by="Borrower",
                                        msg="Need graph paper for a report.",
                                        reason="Found some in my drawer, thanks anyway!")),
    ("X3", 4, (1, 3), "Cancelled", dict(created_days_ago=6, dur=5, cancelled_by="Lender",
                                        msg="Borrowing the mechanics textbook.",
                                        reason="I need the book back for my own revision.")),
]

# --- Accumulators for the generated documents ---
tx_by_code = {}
state_logs = []
qr_tokens = []
scan_events = []
lease_cycles = []
notifications = []

active_item_guard = set()   # item ids that already hold an active transaction


# --- Helpers: notifications, QR tokens and scan events ---

def add_notif(uid, ntype, message, when, tx_id=None, report_id=None, read=True):
    notifications.append({
        "id": new_id(), "recipient_user_id": uid, "transaction_id": tx_id,
        "related_report_id": report_id, "notification_type": ntype,
        "message": message, "is_read": read, "created_at": iso(when),
    })


def make_qr(tx_id, borrower_id, when):
    qr_string, payload_b64, sig, nonce, iat, exp = qr_engine.generate_token(tx_id, borrower_id)
    qr_tokens.append({
        "id": new_id(), "transaction_id": tx_id, "borrower_id": borrower_id,
        "token_payload": payload_b64, "token_hash": sig, "cryptographic_nonce": nonce,
        "algorithm": "HMAC-SHA256", "qr_string": qr_string,
        "issued_at": iso(iat), "expires_at": iso(exp), "is_revoked": False,
        "revoked_at": None, "created_at": iso(when),
    })


def make_scan(tx_id, scanned_by, purpose, result, when, device="Demo seed", error=None):
    ev = {
        "id": new_id(), "token_id": None, "transaction_id": tx_id,
        "scanned_by_user_id": scanned_by, "scan_purpose": purpose, "scan_result": result,
        "device_info": device, "error_message": error,
        "scanned_at": iso(when), "created_at": iso(when),
    }
    scan_events.append(ev)
    return ev


# --- Build one transaction per spec (+ its logs, QR, scans and notifications) ---
for code, b_idx, (o_idx, it_idx), state, kw in TX_SPECS:
    it = item_of(o_idx, it_idx)
    borrower = U[b_idx]
    lender = U[o_idx]
    assert borrower != lender, f"{code}: borrower == lender"
    real_state = "Borrowed" if state == "Overdue" else state
    if real_state in ACTIVE_STATES:
        assert it["id"] not in active_item_guard, f"{code}: item double-active"
        active_item_guard.add(it["id"])

    created = days_ago(kw["created_days_ago"])
    dur = kw.get("dur", 5)

    # Borrow window per state
    if state == "Completed":
        start = -(kw["created_days_ago"]); end = start + dur
    elif state == "Borrowed":
        start = -kw["created_days_ago"]; end = dur - kw["created_days_ago"]
        if end <= 0:
            end = 3
    elif state == "Overdue":
        ov = kw["overdue"]; end = -ov; start = end - dur
    elif state in ("Approved", "Pending"):
        start = 1; end = 1 + dur
    else:  # Rejected / Cancelled
        start = -(kw["created_days_ago"]) + 1; end = start + dur

    tx = {
        "id": new_id(), "borrower_id": borrower, "lender_id": lender, "item_id": it["id"],
        "request_message": kw.get("msg"),
        "borrow_start_date": date_offset(start), "borrow_end_date": date_offset(end),
        "status": real_state,
        "rejection_reason": kw.get("reason") if state == "Rejected" else None,
        "cancellation_reason": kw.get("reason") if state == "Cancelled" else None,
        "cancelled_by": kw.get("cancelled_by") if state == "Cancelled" else None,
        "approval_timestamp": None,
        "return_requested": False,
        "created_at": iso(created), "updated_at": iso(created),
    }
    tx_by_code[code] = tx

    # State logs (request always logged; approvals/terminal where relevant)
    state_logs.append({"id": new_id(), "transaction_id": tx["id"], "previous_status": None,
                       "new_status": "Pending", "changed_by_user_id": borrower,
                       "change_reason": None, "created_at": iso(created)})

    # Notify lender of the incoming request (recent ones unread)
    add_notif(lender, "RequestReceived",
              f"{users[b_idx]['full_name']} requested to borrow your '{it['title']}'.",
              created, tx_id=tx["id"], read=(state not in ("Pending",)))

    approved_at = created + timedelta(hours=random.randint(2, 30))
    if real_state in ("Approved", "Borrowed") or state == "Completed":
        tx["approval_timestamp"] = iso(approved_at)
        tx["updated_at"] = iso(approved_at)
        state_logs.append({"id": new_id(), "transaction_id": tx["id"], "previous_status": "Pending",
                           "new_status": "Approved", "changed_by_user_id": lender,
                           "change_reason": None, "created_at": iso(approved_at)})
        add_notif(borrower, "RequestApproved",
                  f"Your request to borrow '{it['title']}' was approved! Show your QR at handover.",
                  approved_at, tx_id=tx["id"], read=(state != "Approved"))

    if state == "Approved":
        it["availability_status"] = "Pending"
        make_qr(tx["id"], borrower, approved_at)

    elif state == "Pending":
        it["availability_status"] = "Pending"

    elif state == "Rejected":
        it["availability_status"] = "Available"
        rej_at = created + timedelta(hours=random.randint(2, 20))
        tx["updated_at"] = iso(rej_at)
        state_logs.append({"id": new_id(), "transaction_id": tx["id"], "previous_status": "Pending",
                           "new_status": "Rejected", "changed_by_user_id": lender,
                           "change_reason": kw.get("reason"), "created_at": iso(rej_at)})
        add_notif(borrower, "RequestRejected",
                  f"Your request to borrow '{it['title']}' was rejected. Reason: {kw.get('reason')}",
                  rej_at, tx_id=tx["id"], read=True)

    elif state == "Cancelled":
        it["availability_status"] = "Available"
        can_at = created + timedelta(hours=random.randint(3, 28))
        tx["updated_at"] = iso(can_at)
        state_logs.append({"id": new_id(), "transaction_id": tx["id"], "previous_status": "Pending",
                           "new_status": "Cancelled", "changed_by_user_id":
                           borrower if kw["cancelled_by"] == "Borrower" else lender,
                           "change_reason": kw.get("reason"), "created_at": iso(can_at)})
        other = lender if kw["cancelled_by"] == "Borrower" else borrower
        add_notif(other, "RequestCancelled",
                  f"A borrow request for '{it['title']}' was cancelled by the {kw['cancelled_by'].lower()}. "
                  f"Reason: {kw.get('reason')}", can_at, tx_id=tx["id"], read=True)

    elif state == "Borrowed":
        it["availability_status"] = "Borrowed"
        handover_at = approved_at + timedelta(hours=random.randint(1, 24))
        make_qr(tx["id"], borrower, approved_at)
        ev = make_scan(tx["id"], lender, "Handover", "Success", handover_at)
        state_logs.append({"id": new_id(), "transaction_id": tx["id"], "previous_status": "Approved",
                           "new_status": "Borrowed", "changed_by_user_id": lender,
                           "change_reason": "QR handover scan", "created_at": iso(handover_at)})
        lease_cycles.append({
            "id": new_id(), "transaction_id": tx["id"],
            "handover_scan_event_id": ev["id"], "return_scan_event_id": None,
            "handover_timestamp": iso(handover_at), "return_timestamp": None,
            "expected_return_date": tx["borrow_end_date"], "lease_status": "Active",
            "overdue_days": 0, "created_at": iso(handover_at), "updated_at": iso(handover_at),
        })
        tx["updated_at"] = iso(handover_at)
        add_notif(borrower, "HandoverConfirmed",
                  f"Handover of '{it['title']}' confirmed via QR. Enjoy — remember to return on time!",
                  handover_at, tx_id=tx["id"], read=True)

    elif state == "Overdue":
        it["availability_status"] = "Borrowed"
        handover_at = approved_at + timedelta(hours=random.randint(1, 12))
        make_qr(tx["id"], borrower, approved_at)
        ev = make_scan(tx["id"], lender, "Handover", "Success", handover_at)
        state_logs.append({"id": new_id(), "transaction_id": tx["id"], "previous_status": "Approved",
                           "new_status": "Borrowed", "changed_by_user_id": lender,
                           "change_reason": "QR handover scan", "created_at": iso(handover_at)})
        lease_cycles.append({
            "id": new_id(), "transaction_id": tx["id"],
            "handover_scan_event_id": ev["id"], "return_scan_event_id": None,
            "handover_timestamp": iso(handover_at), "return_timestamp": None,
            "expected_return_date": tx["borrow_end_date"], "lease_status": "Active",
            "overdue_days": kw["overdue"], "created_at": iso(handover_at), "updated_at": iso(NOW),
        })
        tx["return_requested"] = True
        tx["updated_at"] = iso(NOW - timedelta(days=1))
        add_notif(borrower, "HandoverConfirmed",
                  f"Handover of '{it['title']}' confirmed via QR.", handover_at, tx_id=tx["id"], read=True)
        add_notif(borrower, "ReturnReminder",
                  f"Your loan of '{it['title']}' is overdue by {kw['overdue']} day(s). Please arrange a return ASAP.",
                  NOW - timedelta(hours=random.randint(2, 20)), tx_id=tx["id"], read=False)

    elif state == "Completed":
        it["availability_status"] = "Available"
        handover_at = approved_at + timedelta(hours=random.randint(1, 24))
        return_at = created + timedelta(days=dur, hours=random.randint(1, 10))
        if return_at > NOW:
            return_at = NOW - timedelta(days=1)
        make_qr(tx["id"], borrower, approved_at)
        ev_h = make_scan(tx["id"], lender, "Handover", "Success", handover_at)
        ev_r = make_scan(tx["id"], lender, "Return", "Success", return_at)
        for prev, nxt, who, when, reason in [
            ("Approved", "Borrowed", lender, handover_at, "QR handover scan"),
            ("Borrowed", "Completed", lender, return_at, "QR return scan"),
        ]:
            state_logs.append({"id": new_id(), "transaction_id": tx["id"], "previous_status": prev,
                               "new_status": nxt, "changed_by_user_id": who,
                               "change_reason": reason, "created_at": iso(when)})
        lease_cycles.append({
            "id": new_id(), "transaction_id": tx["id"],
            "handover_scan_event_id": ev_h["id"], "return_scan_event_id": ev_r["id"],
            "handover_timestamp": iso(handover_at), "return_timestamp": iso(return_at),
            "expected_return_date": tx["borrow_end_date"], "lease_status": "Completed",
            "overdue_days": 0, "created_at": iso(handover_at), "updated_at": iso(return_at),
        })
        tx["updated_at"] = iso(return_at)
        add_notif(borrower, "ReturnConfirmed",
                  f"Return of '{it['title']}' confirmed. Please rate your lender!", return_at, tx_id=tx["id"], read=True)
        add_notif(lender, "ReturnConfirmed",
                  f"'{it['title']}' was returned. Please rate your borrower!", return_at, tx_id=tx["id"], read=True)

# A couple of extra scan events to enrich the admin transaction timeline.
make_scan(tx_by_code["O3"]["id"], U[2], "Return", "Expired",
          NOW - timedelta(hours=6), device="iPhone 13", error="QR token expired before scan.")
make_scan(tx_by_code["B1"]["id"], U[1], "Handover", "Camera_Error",
          NOW - timedelta(days=4, hours=2),
          device="Android", error="Camera permission denied.")

# ============================================================================
#  Ratings — mutual borrower/lender reviews + trust scores
# ============================================================================
# (tx_code, rater_idx, ratee_idx, stars, feedback)
RATINGS_DEF = [
    ("C1", 2, 0, 5, "Exactly as described and super helpful. Smooth handover!"),
    ("C1", 0, 2, 5, "Returned promptly and in perfect condition. Great borrower."),
    ("C2", 0, 1, 5, "Caliper was precise and spotless. Thanks Daniel!"),
    ("C2", 1, 0, 4, "Good borrower, returned a day early."),
    ("C3", 4, 2, 5, "Lifesaver before my chemistry final — much appreciated."),
    ("C3", 2, 4, 5, "Took great care of the textbook. Would lend again."),
    ("C4", 1, 4, 4, "Useful but a little more worn than expected."),
    ("C4", 4, 1, 5, "Very communicative, easy handover. Recommended."),
    ("C5", 0, 3, 5, "Friendly and returned right on time."),     # Hafiz has NOT rated -> pending action
    ("C6", 0, 5, 2, "Item was missing a couple of parts and the return was late."),
    ("C6", 5, 0, 5, "No issues on my side, pleasant to deal with."),
    ("C7", 2, 5, 1, "The listing didn't match the actual condition. Wouldn't borrow again."),
    ("C7", 5, 2, 4, "Okay overall, returned fine."),
    ("C8", 3, 4, 5, "Careful borrower, returned early. Thank you!"),  # Mei has NOT rated -> pending action
]

ratings = []
received = {uid: [] for uid in U}
for code, r_idx, e_idx, stars, fb in RATINGS_DEF:
    tx = tx_by_code[code]
    when = datetime.fromisoformat(tx["updated_at"]) + timedelta(hours=random.randint(1, 18))
    if when > NOW:
        when = NOW - timedelta(hours=2)
    ratings.append({
        "id": new_id(), "rater_id": U[r_idx], "ratee_id": U[e_idx],
        "transaction_id": tx["id"], "item_id": tx["item_id"],
        "stars": stars, "feedback": fb, "created_at": iso(when),
    })
    received[U[e_idx]].append(stars)
    add_notif(U[e_idx], "RatingReceived", f"You received a {stars}-star rating.", when, tx_id=tx["id"], read=True)

# Trust scores from received ratings (Arjun additionally carries an admin penalty).
for idx, u in enumerate(users):
    got = received[u["id"]]
    u["trust_score"] = round(sum(got) / len(got), 2) if got else 5.0
PENALTY_POINTS = 0.2
users[5]["trust_score"] = round(max(0.0, users[5]["trust_score"] - PENALTY_POINTS), 2)

# ============================================================================
#  Reports & moderation — user, item and chat reports + admin actions
# ============================================================================
reports = []
moderation_actions = []


def add_report(reporter_idx, reported_user_idx, reported_item_id, category, status,
               incident_when=None, evidence=None, description=None, days=3,
               reviewed=False, dismissal_note=None, is_user_report=False, extra=None):
    submitted = days_ago(days)
    rep = {
        "id": new_id(), "reporter_id": U[reporter_idx],
        "reported_item_id": reported_item_id, "reported_user_id": U[reported_user_idx],
        "report_category": category, "description": description,
        "report_status": status, "incident_when": incident_when,
        "evidence": evidence or [], "confirmed_truthful": True,
        "reviewed_by_admin_id": ADMIN_ID if reviewed else None,
        "reviewed_at": iso(submitted + timedelta(days=1)) if reviewed else None,
        "dismissal_note": dismissal_note,
        "submitted_at": iso(submitted), "created_at": iso(submitted),
        "updated_at": iso(submitted + timedelta(days=1)) if reviewed else iso(submitted),
    }
    if extra:
        rep.update(extra)
    reports.append(rep)
    add_notif(U[reporter_idx], "Report_Submitted",
              "Your report was submitted and is under review by moderators." if not reviewed
              else "Your report was reviewed by a moderator.", submitted, report_id=rep["id"], read=reviewed)
    return rep


USER_KEY = lambda idx: f"__user__:{U[idx]}"

# Two user-reports against Arjun (idx 5) -> Repeatedly_Reported fraud flag.
add_report(0, 5, USER_KEY(5), "Damaged_Dangerous", "Pending",
           incident_when="At/After return", evidence=[EVIDENCE_RED],
           description="Returned the Arduino kit with two sensors missing and a bent pin header.",
           days=4, is_user_report=True)
add_report(2, 5, USER_KEY(5), "False_Scam", "Under_Review",
           incident_when="During the loan", evidence=[EVIDENCE_AMBER, EVIDENCE_SLATE],
           description="Listing photos did not match the actual item I received.",
           days=3, is_user_report=True)

# Item report (pending) — Mei's projector listing.
proj = item_of(4, 6)
add_report(3, 4, proj["id"], "False_Listing", "Pending",
           incident_when="Before handover", evidence=[],
           description="The projector brightness is nowhere near what the description claims.",
           days=2)
proj["report_count"] += 1

# Item report (ACTIONED -> item removed) — Priya's slide box.
slide = item_of(2, 6)
rep_removed = add_report(1, 2, slide["id"], "Prohibited_Illegal", "Actioned",
                         incident_when="Other", evidence=[EVIDENCE_RED],
                         description="This looks like restricted lab equipment that shouldn't be shared.",
                         days=6, reviewed=True)
slide["availability_status"] = "Removed"
slide["report_count"] += 1
moderation_actions.append({
    "id": new_id(), "report_id": rep_removed["id"], "admin_id": ADMIN_ID,
    "action_type": "Remove_Item", "target_item_id": slide["id"], "target_user_id": U[2],
    "reason": "Listing removed pending verification of lab-equipment sharing policy.",
    "created_at": rep_removed["reviewed_at"],
})
add_notif(U[2], "Item_Removed",
          f"Your listing '{slide['title']}' was removed by moderation pending review.",
          datetime.fromisoformat(rep_removed["reviewed_at"]), read=False)

# Item report (DISMISSED) — Arjun's desk lamp.
lamp = item_of(5, 6)
rep_dismissed = add_report(4, 5, lamp["id"], "Other", "Dismissed",
                           incident_when="During handover", evidence=[],
                           description="Thought the lamp flickered, but it turned out to be a loose socket on my end.",
                           days=5, reviewed=True,
                           dismissal_note="No policy violation found; hardware issue was on the borrower's side.")
moderation_actions.append({
    "id": new_id(), "report_id": rep_dismissed["id"], "admin_id": ADMIN_ID,
    "action_type": "Dismiss", "target_item_id": lamp["id"], "target_user_id": U[5],
    "reason": "No violation found.", "created_at": rep_dismissed["reviewed_at"],
})

# Chat-originated report on an active loan (B3) — unlocks transcript review.
b3 = tx_by_code["B3"]
chat_report = {
    "id": new_id(), "reporter_id": b3["borrower_id"], "reported_user_id": b3["lender_id"],
    "reported_item_id": f"__user__:{b3['lender_id']}", "transaction_id": b3["id"],
    "target_transaction_id": b3["id"], "item_id": b3["item_id"],
    "report_category": "Inappropriate_Offensive", "report_type": "Chat",
    "description": "Felt pressured by some messages about returning the lab coat early.",
    "report_status": "Pending", "grants_chat_access": True,
    "incident_when": "During the loan", "evidence": [], "confirmed_truthful": True,
    "reviewed_by_admin_id": None, "reviewed_at": None, "dismissal_note": None,
    "submitted_at": iso(days_ago(1)), "created_at": iso(days_ago(1)), "updated_at": iso(days_ago(1)),
}
reports.append(chat_report)

# ============================================================================
#  Suspensions & penalties — a full suspend → reinstate lifecycle
# ============================================================================
# A completed suspension lifecycle for Arjun (account is Active again now).
susp_start = days_ago(30)
susp_end = days_ago(23)
user_suspensions = [{
    "id": new_id(), "user_id": U[5], "action_id": None,
    "suspended_by_admin_id": ADMIN_ID, "suspension_type": "7_Day",
    "start_at": iso(susp_start), "end_at": iso(susp_end), "is_active": False,
    "reason": "Repeated late returns during the first weeks on the platform.",
    "created_at": iso(susp_start),
}]
add_notif(U[5], "Account_Suspended",
          "Your account was suspended (7 Day). Reason: Repeated late returns.", susp_start, read=True)
add_notif(U[5], "Account_Reinstated",
          "Good news — your account has been reinstated. Please return items on time going forward.",
          susp_end, read=True)

# Trust-score penalty applied to Arjun, tied to the overdue soldering-iron loan.
o1 = tx_by_code["O1"]
penalties = [{
    "id": new_id(), "user_id": U[5], "transaction_id": o1["id"],
    "points": PENALTY_POINTS, "reason": "Overdue return of the Soldering Iron Station.",
    "issued_by_admin_id": ADMIN_ID, "trust_score_after": users[5]["trust_score"],
    "created_at": iso(days_ago(2)),
}]
add_notif(U[5], "PenaltyApplied",
          f"A trust-score penalty of -{PENALTY_POINTS} was applied. Reason: Overdue return of the Soldering Iron Station.",
          days_ago(2), tx_id=o1["id"], read=False)

# ============================================================================
#  Admin audit trail — moderator actions log
# ============================================================================
admin_audit = []


def audit(action_type, summary, when, target_user=None, target_item=None, target_tx=None, meta=None):
    admin_audit.append({
        "id": new_id(), "admin_id": ADMIN_ID, "admin_user_id": ADMIN_UID,
        "admin_name": admin_user["full_name"], "admin_role": "Senior_Moderator",
        "action_type": action_type, "summary": summary,
        "target_user_id": target_user, "target_item_id": target_item,
        "target_transaction_id": target_tx, "meta": meta or {},
        "created_at": iso(when),
    })


audit("Session_Elevated", "Passed MFA and opened the admin portal.", days_ago(2, 9))
audit("User_Suspended", "Suspended Arjun Kumar (7 Day). Posts: keep. Repeated late returns.",
      susp_start, target_user=U[5], meta={"suspension_type": "7_Day"})
audit("User_Reinstated", "Reinstated Arjun Kumar after the suspension period ended.",
      susp_end, target_user=U[5])
audit("Report_Resolved", "Removed listing 'Microscope Slide Storage Box' pending policy review.",
      datetime.fromisoformat(rep_removed["reviewed_at"]), target_user=U[2], target_item=slide["id"])
audit("Report_Dismissed", "Dismissed report on 'Adjustable LED Desk Lamp' — no violation found.",
      datetime.fromisoformat(rep_dismissed["reviewed_at"]), target_user=U[5], target_item=lamp["id"])
audit("Reminder_Sent", "Sent an overdue reminder for 'Soldering Iron Station'.",
      days_ago(2, 11), target_user=U[5], target_tx=o1["id"])
audit("Penalty_Applied", f"Applied -{PENALTY_POINTS} trust penalty to Arjun Kumar. Overdue return.",
      days_ago(2, 12), target_user=U[5], target_tx=o1["id"],
      meta={"points": PENALTY_POINTS, "trust_score_after": users[5]["trust_score"]})

# ============================================================================
#  Help tickets — student support requests
# ============================================================================
help_tickets = [
    {"id": new_id(), "user_id": U[5], "user_name": users[5]["full_name"],
     "subject": "Trouble returning an item on time",
     "message": "I've been unwell and couldn't return the soldering iron. How do I avoid a penalty?",
     "transaction_id": o1["id"], "status": "Open",
     "created_at": iso(days_ago(2, 8)), "updated_at": iso(days_ago(2, 8))},
    {"id": new_id(), "user_id": U[3], "user_name": users[3]["full_name"],
     "subject": "How do I edit a listing that's on loan?",
     "message": "Can I update the description of an item while it's borrowed?",
     "transaction_id": None, "status": "Open",
     "created_at": iso(days_ago(1, 14)), "updated_at": iso(days_ago(1, 14))},
    {"id": new_id(), "user_id": U[0], "user_name": users[0]["full_name"],
     "subject": "Updating my campus on my profile",
     "message": "I moved to the Pagoh campus — is the verified campus field something I set myself?",
     "transaction_id": None, "status": "Resolved",
     "created_at": iso(days_ago(8, 10)), "updated_at": iso(days_ago(7, 16))},
]

# ============================================================================
#  Saved items — users' bookmarked listings
# ============================================================================
SAVED_DEF = [
    (0, (1, 1)), (0, (4, 0)), (0, (2, 2)),
    (1, (0, 1)), (1, (3, 2)),
    (2, (4, 3)), (2, (5, 0)),
    (3, (0, 0)), (3, (1, 5)),
    (4, (0, 5)), (4, (2, 0)), (4, (5, 6)),
    (5, (1, 0)), (5, (4, 2)),
]
saved_items = []
for u_idx, (o_idx, it_idx) in SAVED_DEF:
    saved_items.append({
        "id": new_id(), "user_id": U[u_idx], "item_id": item_of(o_idx, it_idx)["id"],
        "saved_at": NOW - timedelta(days=random.randint(1, 20), hours=random.randint(0, 23)),
    })

# ============================================================================
#  Chat — encrypted borrower/lender conversations
# ============================================================================
chat_sessions = []
chat_messages = []

CHAT_DEF = {
    "A1": [(1, "Hi! Are you free to hand over the USB-C hub tomorrow afternoon?"),
           (0, "Sure, around 3pm at the KTC cafe works for me."),
           (1, "Perfect, see you then. I'll bring my student ID for the QR.")],
    "B1": [(3, "Thanks for approving! When can I pick up the drill?"),
           (1, "Anytime today after 5pm at Kolej 9 block C."),
           (3, "Got it, picking it up now. Scanning the handover QR.")],
    "B3": [(1, "Hi Priya, is the lab coat clean and ready?"),
           (2, "Yes, freshly laundered. Please return it by the due date though, I need it for my own lab."),
           (1, "Of course. Could you remind me a day before? I tend to forget."),
           (2, "Please just return it on time — I can't keep chasing. It's due this week."),
           (1, "Understood, no need to be harsh about it.")],
    "C2": [(0, "Caliper handover done, thank you!"),
           (1, "Great, enjoy. Ping me if the battery runs low."),
           (0, "Returned it today, all good. Left you a 5-star rating!")],
}

for code, msgs in CHAT_DEF.items():
    tx = tx_by_code[code]
    closed = tx["status"] in ("Completed", "Cancelled", "Rejected")
    state = "Closed" if closed else "Active"
    session = {
        "id": new_id(), "transaction_id": tx["id"], "item_id": tx["item_id"],
        "borrower_id": tx["borrower_id"], "lender_id": tx["lender_id"],
        "state": state, "created_at": tx["approval_timestamp"] or tx["created_at"],
        "updated_at": tx["updated_at"],
    }
    if code == "B3":
        session["under_review"] = True   # a report was filed on this conversation
    chat_sessions.append(session)
    base_when = datetime.fromisoformat(tx["approval_timestamp"] or tx["created_at"])
    for n, (sender_idx, text) in enumerate(msgs):
        when = base_when + timedelta(minutes=15 * (n + 1))
        chat_messages.append({
            "id": new_id(), "session_id": session["id"], "transaction_id": tx["id"],
            "sender_id": U[sender_idx], "kind": "text", "file_name": None,
            "ciphertext": crypto_box.encrypt(text),
            "created_at": iso(when),
            "read_at": iso(when + timedelta(minutes=5)) if n < len(msgs) - 1 else None,
        })

# ============================================================================
#  Insert & main — write every collection to MongoDB
# ============================================================================

def insert(coll, docs):
    if docs:
        db[coll].insert_many(docs)
    return len(docs)


def main():
    wipe()
    counts = {}
    counts["users"] = insert("users", users + [admin_user])
    counts["admins"] = insert("admins", [admin_record])
    counts["items"] = insert("items", items)
    counts["transactions"] = insert("transactions", list(tx_by_code.values()))
    counts["transaction_state_logs"] = insert("transaction_state_logs", state_logs)
    counts["qr_tokens"] = insert("qr_tokens", qr_tokens)
    counts["scan_events"] = insert("scan_events", scan_events)
    counts["lease_cycles"] = insert("lease_cycles", lease_cycles)
    counts["user_ratings"] = insert("user_ratings", ratings)
    counts["notifications"] = insert("notifications", notifications)
    counts["reports"] = insert("reports", reports)
    counts["moderation_actions"] = insert("moderation_actions", moderation_actions)
    counts["user_suspensions"] = insert("user_suspensions", user_suspensions)
    counts["penalties"] = insert("penalties", penalties)
    counts["admin_audit"] = insert("admin_audit", admin_audit)
    counts["help_tickets"] = insert("help_tickets", help_tickets)
    counts["saved_items"] = insert("saved_items", saved_items)
    counts["chat_sessions"] = insert("chat_sessions", chat_sessions)
    counts["chat_messages"] = insert("chat_messages", chat_messages)

    print("\nInserted:")
    for k, v in counts.items():
        print(f"  {k:24} {v}")

    print("\nTransaction state distribution:")
    dist = {}
    for tx in tx_by_code.values():
        dist[tx["status"]] = dist.get(tx["status"], 0) + 1
    for k, v in sorted(dist.items()):
        print(f"  {k:12} {v}")

    print("\nAccounts (password: Test1234):")
    print(f"  ADMIN  {admin_user['email']}  ({admin_user['full_name']})")
    for u in users:
        print(f"  USER   {u['email']:36} trust={u['trust_score']}  ({u['full_name']})")
    print("\nDone. Database reset & seeded.")


if __name__ == "__main__":
    main()