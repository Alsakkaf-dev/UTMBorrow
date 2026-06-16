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


