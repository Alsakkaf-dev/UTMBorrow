"""Resource Catalog & Discovery (spec section 4).

Controlled value lists follow the Software Data Design (SDD §4.2/§4.3):
Categories, Conditions, Colleges, Faculties are server-enforced on every write.
Location-based discovery (SRS UC2301-2303) supports manual college/faculty
selection, GPS proximity, and ascending/descending distance sorting using
predefined approximate campus coordinates.
"""
import math
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from database import db, new_id, now_utc, iso, clean
from security import get_current_user
from realtime import broadcaster

router = APIRouter(prefix="/api/items", tags=["items"])

# --- Controlled value lists (SDD §4.2.2 / §4.3.2) ---------------------------
CATEGORIES = ["Electronics", "Textbooks", "Lab Equipment", "Tools", "Clothing", "Other"]
CONDITIONS = ["Like New", "Good", "Fair", "Poor"]
COLLEGES = ["Kolej Tuanku Canselor", "Kolej 9", "Kolej Perdana", "Kolej Rahman Putra", "Other"]
FACULTIES = ["Computing", "Engineering", "Science", "Built Environment", "Other"]

# Condition quality ranking for the SRS UC2202 "minimum acceptable condition"
# threshold filter (higher = better). Selecting "Good" returns Like New + Good.
CONDITION_RANK = {"Like New": 4, "Good": 3, "Fair": 2, "Poor": 1}

# Approximate UTM Johor Bahru campus coordinates (lat, lng) for proximity /
# distance sorting (SRS UC2301-2303). No third-party map service required.
COLLEGE_COORDS = {
    "Kolej Tuanku Canselor": (1.5599, 103.6380),
    "Kolej 9": (1.5650, 103.6320),
    "Kolej Perdana": (1.5580, 103.6440),
    "Kolej Rahman Putra": (1.5547, 103.6300),
}
FACULTY_COORDS = {
    "Computing": (1.5586, 103.6320),
    "Engineering": (1.5570, 103.6390),
    "Science": (1.5601, 103.6350),
    "Built Environment": (1.5560, 103.6410),
}

VISIBILITY_VALUES = ("Public", "Private")


def _haversine_km(a: tuple, b: tuple) -> float:
    """Great-circle distance in km between two (lat, lng) points."""
    r = 6371.0
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(h)), 3)


def _item_coords(it: dict):
    """Best-effort coordinates for an item from its college, then faculty."""
    return COLLEGE_COORDS.get(it.get("location_college")) or FACULTY_COORDS.get(it.get("location_faculty"))


class ItemIn(BaseModel):
    title: str = Field(min_length=2, max_length=150)
    description: Optional[str] = Field(default=None, max_length=2000)
    category: str
    condition: str
    location_college: str
    location_faculty: Optional[str] = None
    photo_url: Optional[str] = None  # base64 data URL (stubbed upload)


class VisibilityIn(BaseModel):
    visibility: str  # "Public" | "Private"


def _validate_enums(body: ItemIn):
    if body.category not in CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category.")
    if body.condition not in CONDITIONS:
        raise HTTPException(status_code=400, detail="Invalid condition.")
    if body.location_college not in COLLEGES:
        raise HTTPException(status_code=400, detail="Invalid college.")
    if body.location_faculty not in (None, "", *FACULTIES):
        raise HTTPException(status_code=400, detail="Invalid faculty.")
    if body.photo_url and len(body.photo_url) > 7_500_000:  # ~5MB base64
        raise HTTPException(status_code=400, detail="Image too large (max 5MB).")


async def _owner_brief(owner_id: str):
    u = await db.users.find_one({"id": owner_id})
    if not u:
        return None
    return {"id": u["id"], "full_name": u["full_name"], "trust_score": u.get("trust_score", 5.0),
            "profile_picture": u.get("profile_picture")}


@router.get("/meta")
async def meta():
    return {"categories": CATEGORIES, "conditions": CONDITIONS,
            "colleges": COLLEGES, "faculties": FACULTIES}


@router.get("")
async def browse(
    q: Optional[str] = None,
    category: Optional[str] = None,   # one value or comma-separated list (UC2201 multi-select)
    condition: Optional[str] = None,  # minimum acceptable condition (UC2202 threshold)
    college: Optional[str] = None,
    faculty: Optional[str] = None,
    lat: Optional[float] = None,      # device GPS latitude (UC2302)
    lng: Optional[float] = None,      # device GPS longitude (UC2302)
    radius_km: Optional[float] = None,  # proximity radius; SRS default 2km when location mode active
    sort: Optional[str] = None,       # "recent" | "distance_asc" | "distance_desc"
):
    # Only Public items appear in the catalog; Private ones stay hidden from everyone else.
    query = {"availability_status": "Available", "visibility": {"$ne": "Private"}}
    if category:
        cats = [c.strip() for c in category.split(",") if c.strip()]
        if cats:
            query["category"] = {"$in": cats}
    if condition and condition != "Any":
        threshold = CONDITION_RANK.get(condition)
        if threshold is not None:
            allowed = [c for c, r in CONDITION_RANK.items() if r >= threshold]
            query["condition"] = {"$in": allowed}
    if college:
        query["location_college"] = college
    if faculty:
        query["location_faculty"] = faculty
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]
    items = await db.items.find(query).sort("created_at", -1).to_list(500)

    # Resolve a proximity reference point: device GPS (UC2302) wins, else the
    # selected college's coordinates (UC2301 manual selection).
    ref = None
    if lat is not None and lng is not None:
        ref = (lat, lng)
    elif college in COLLEGE_COORDS:
        ref = COLLEGE_COORDS[college]

    # hide listings owned by suspended/banned users
    out = []
    for it in items:
        owner = await db.users.find_one({"id": it["owner_id"]})
        if owner and owner.get("account_status") == "Active":
            it = clean(it)
            it["owner"] = await _owner_brief(it["owner_id"])
            if ref:
                coords = _item_coords(it)
                it["distance_km"] = _haversine_km(ref, coords) if coords else None
            out.append(it)

    # Proximity radius filter (SRS UC2301/2302: 2km default). Items without a
    # known location are kept and surfaced at the end (UC2301 A2 / UC2302 A2).
    if ref:
        r = radius_km if radius_km is not None else 2.0
        out = [it for it in out if it.get("distance_km") is None or it["distance_km"] <= r]

    # Sorting
    if sort in ("distance_asc", "distance_desc") and ref:
        with_loc = [it for it in out if it.get("distance_km") is not None]
        without_loc = [it for it in out if it.get("distance_km") is None]
        with_loc.sort(key=lambda it: it["distance_km"], reverse=(sort == "distance_desc"))
        out = with_loc + without_loc  # unknown-location items always trail
    elif sort == "recent":
        out.sort(key=lambda it: it.get("last_refreshed_at") or it.get("created_at") or "", reverse=True)

    return {"items": out}


@router.get("/mine")
async def my_items(user: dict = Depends(get_current_user)):
    # Strict per-user isolation: never serve another owner's listings here.
    uid = user.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")
    items = await db.items.find(
        {"owner_id": uid, "availability_status": {"$ne": "Removed"}}
    ).sort("created_at", -1).to_list(500)
    # Defensive second pass: drop anything not owned by the caller.
    return {"items": [clean(i) for i in items if i.get("owner_id") == uid]}


@router.get("/{item_id}")
async def get_item(item_id: str):
    it = await db.items.find_one({"id": item_id})
    if not it or it["availability_status"] == "Removed":
        raise HTTPException(status_code=404, detail="Item not found.")
    it = clean(it)
    it["owner"] = await _owner_brief(it["owner_id"])
    return {"item": it}


@router.post("")
async def create_item(body: ItemIn, user: dict = Depends(get_current_user)):
    _validate_enums(body)
    if not body.photo_url:
        # SRS UC2101 A2: at least one photo is required to publish.
        raise HTTPException(status_code=400, detail="Please upload at least one photo of your item.")
    # SRS UC2101 A3: block identical re-submission (same title + lender) within 5 minutes.
    from datetime import timedelta
    cutoff = iso(now_utc() - timedelta(minutes=5))
    dup = await db.items.find_one({
        "owner_id": user["id"],
        "title": body.title.strip(),
        "created_at": {"$gte": cutoff},
    })
    if dup:
        raise HTTPException(
            status_code=400,
            detail="You already listed this item recently. Please wait before listing it again.",
        )
    now = iso(now_utc())
    item = {
        "id": new_id(), "owner_id": user["id"], "title": body.title.strip(),
        "description": (body.description or "").strip() or None,
        "category": body.category, "condition": body.condition,
        "location_college": body.location_college,
        "location_faculty": body.location_faculty or None,
        "photo_url": body.photo_url, "availability_status": "Available",
        "visibility": "Public",   # new listings are publicly visible by default
        "report_count": 0, "created_at": now, "last_refreshed_at": now,
    }
    await db.items.insert_one(item)
    out = clean(item)
    out["owner"] = await _owner_brief(user["id"])
    await broadcaster.publish("catalog.changed", {"reason": "created", "item_id": item["id"]})
    return {"item": out}


@router.put("/{item_id}")
async def edit_item(item_id: str, body: ItemIn, user: dict = Depends(get_current_user)):
    it = await db.items.find_one({"id": item_id})
    if not it:
        raise HTTPException(status_code=404, detail="Item not found.")
    if it["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own listings.")
    if it["availability_status"] == "Removed":
        raise HTTPException(status_code=400, detail="This item was removed by moderation.")
    # SRS UC2102 A1: editing a Pending/Borrowed listing is allowed (with a
    # client-side confirmation). It updates listing metadata ONLY and never
    # touches availability_status or the linked transaction.
    _validate_enums(body)
    await db.items.update_one({"id": item_id}, {"$set": {
        "title": body.title.strip(),
        "description": (body.description or "").strip() or None,
        "category": body.category, "condition": body.condition,
        "location_college": body.location_college,
        "location_faculty": body.location_faculty or None,
        "photo_url": body.photo_url,
        "updated_at": iso(now_utc()),
    }})
    updated = await db.items.find_one({"id": item_id})
    await broadcaster.publish("catalog.changed", {"reason": "updated", "item_id": item_id})
    await broadcaster.publish("item.updated", {"item_id": item_id})
    return {"item": clean(updated)}


@router.delete("/{item_id}")
async def delete_item(item_id: str, user: dict = Depends(get_current_user)):
    it = await db.items.find_one({"id": item_id})
    if not it:
        raise HTTPException(status_code=404, detail="Item not found.")
    if it["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only delete your own listings.")
    # SRS UC2103 A1: removing a Pending/Approved/Borrowed listing is allowed
    # (with a client-side confirmation). For items tied to an active transaction
    # we soft-remove (availability_status="Removed") so the catalog hides it
    # while the linked lease/transaction continues entirely unaffected. Items
    # with no active transaction are hard-deleted as before.
    if it["availability_status"] in ("Pending", "Approved", "Borrowed"):
        await db.items.update_one({"id": item_id}, {"$set": {
            "availability_status": "Removed", "updated_at": iso(now_utc())}})
    else:
        await db.items.delete_one({"id": item_id})
    await broadcaster.publish("catalog.changed", {"reason": "deleted", "item_id": item_id})
    return {"ok": True}


@router.patch("/{item_id}/visibility")
async def set_visibility(item_id: str, body: VisibilityIn, user: dict = Depends(get_current_user)):
    """Instantly toggle a listing Public/Private without touching other fields."""
    if body.visibility not in VISIBILITY_VALUES:
        raise HTTPException(status_code=400, detail="visibility must be 'Public' or 'Private'.")
    it = await db.items.find_one({"id": item_id})
    if not it:
        raise HTTPException(status_code=404, detail="Item not found.")
    if it["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only change visibility of your own listings.")
    if it.get("availability_status") == "Removed":
        raise HTTPException(status_code=400, detail="This item was removed by moderation.")
    await db.items.update_one({"id": item_id}, {"$set": {"visibility": body.visibility}})
    await broadcaster.publish("catalog.changed", {"reason": "visibility_changed", "item_id": item_id})
    await broadcaster.publish("item.updated", {"item_id": item_id})
    updated = await db.items.find_one({"id": item_id})
    return {"item": clean(updated)}


@router.post("/{item_id}/refresh")
async def refresh_item(item_id: str, user: dict = Depends(get_current_user)):
    """SRS UC2103 (Refresh): bump last_refreshed_at so the listing rises in
    the 'Recently Added' sort, without altering any other field."""
    it = await db.items.find_one({"id": item_id})
    if not it:
        raise HTTPException(status_code=404, detail="Item not found.")
    if it["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only refresh your own listings.")
    if it.get("availability_status") == "Removed":
        raise HTTPException(status_code=400, detail="This item was removed by moderation.")
    await db.items.update_one({"id": item_id}, {"$set": {"last_refreshed_at": iso(now_utc())}})
    await broadcaster.publish("catalog.changed", {"reason": "refreshed", "item_id": item_id})
    updated = await db.items.find_one({"id": item_id})
    return {"item": clean(updated)}
