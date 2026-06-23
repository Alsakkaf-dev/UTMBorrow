"""Saved / bookmarked items for a user."""
from fastapi import APIRouter, Depends, HTTPException

from database import db, new_id, now_utc, iso, clean
from security import get_current_user

router = APIRouter(prefix="/api", tags=["saved"])


async def _enrich(item: dict) -> dict:
    item = clean(item)
    owner = await db.users.find_one({"id": item.get("owner_id")})
    if owner:
        item["owner"] = {
            "full_name": owner.get("full_name"),
            "trust_score": owner.get("trust_score"),
            "profile_picture": owner.get("profile_picture"),
        }
    return item


@router.get("/saved")
async def list_saved(user=Depends(get_current_user)):
    docs = await db.saved_items.find({"user_id": user["id"]}).sort("saved_at", -1).to_list(200)
    items = []
    for doc in docs:
        item = await db.items.find_one({"id": doc["item_id"]})
        if not item or item.get("availability_status") == "Removed":
            continue
        # Don't surface a listing the owner later made Private (unless it's mine).
        if item.get("visibility") == "Private" and item.get("owner_id") != user["id"]:
            continue
        if item:
            enriched = await _enrich(item)
            enriched["saved_at"] = iso(doc.get("saved_at"))
            items.append(enriched)
    return {"items": items}


@router.post("/items/{item_id}/save")
async def save_item(item_id: str, user=Depends(get_current_user)):
    item = await db.items.find_one({"id": item_id})
    if not item:
        raise HTTPException(404, "Item not found")
    existing = await db.saved_items.find_one({"user_id": user["id"], "item_id": item_id})
    if not existing:
        await db.saved_items.insert_one({
            "id": new_id(),
            "user_id": user["id"],
            "item_id": item_id,
            "saved_at": now_utc(),
        })
    return {"saved": True}


@router.delete("/items/{item_id}/save")
async def unsave_item(item_id: str, user=Depends(get_current_user)):
    await db.saved_items.delete_one({"user_id": user["id"], "item_id": item_id})
    return {"saved": False}


@router.get("/items/{item_id}/save")
async def save_status(item_id: str, user=Depends(get_current_user)):
    existing = await db.saved_items.find_one({"user_id": user["id"], "item_id": item_id})
    return {"saved": bool(existing)}
