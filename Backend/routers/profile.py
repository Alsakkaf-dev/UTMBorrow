"""Profile management & in-app notification center."""
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends  # noqa: HTTPException used by delete_notification
from pydantic import BaseModel, Field

from database import db, clean
from security import get_current_user

router = APIRouter(prefix="/api", tags=["profile"])

# Verified campus options (SDD §3.2 / Fig 3.2.3.2, UC1201). Server-enforced.
CAMPUSES = ["Skudai", "Kuala Lumpur", "Pagoh"]


class ProfileIn(BaseModel):
    phone_number: Optional[str] = Field(default=None, max_length=20)
    profile_picture: Optional[str] = None  # base64 data URL
    bio: Optional[str] = Field(default=None, max_length=300)  # personal bio (UC1201)
    campus: Optional[str] = None  # verified campus; one of CAMPUSES or null


@router.get("/profile/{user_id}")
async def get_profile(user_id: str):
    u = await db.users.find_one({"id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")
    # Admin accounts are invisible on the public community surface — their
    # identity stays hidden unless/until they respond to a report.
    if await db.admins.find_one({"user_id": user_id, "is_active": True}):
        raise HTTPException(status_code=404, detail="User not found.")
    u = clean(u)
    u.pop("password_hash", None)
    ratings = await db.user_ratings.find({"ratee_id": user_id}).sort("created_at", -1).to_list(200)
    history = []
    for r in ratings:
        rater = await db.users.find_one({"id": r["rater_id"]})
        history.append({"stars": r["stars"], "feedback": r.get("feedback"),
                        "rater_name": rater["full_name"] if rater else "Unknown",
                        "created_at": r["created_at"]})
    completed = await db.transactions.count_documents(
        {"$or": [{"borrower_id": user_id}, {"lender_id": user_id}], "status": "Completed"})
    return {"user": u, "rating_history": history, "rating_count": len(history),
            "completed_transactions": completed}


@router.put("/profile")
async def update_profile(body: ProfileIn, user: dict = Depends(get_current_user)):
    if body.profile_picture and len(body.profile_picture) > 7_500_000:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB).")
    # Validate type server-side too (the client check is bypassable): only JPEG/PNG data URLs.
    if body.profile_picture and not body.profile_picture.startswith(
            ("data:image/jpeg;base64,", "data:image/png;base64,")):
        raise HTTPException(status_code=400, detail="Profile picture must be a JPEG or PNG image.")
    if body.campus not in (None, "", *CAMPUSES):
        raise HTTPException(status_code=400, detail="Invalid campus.")
    update = {}
    if body.phone_number is not None:
        update["phone_number"] = body.phone_number.strip() or None
    if body.profile_picture is not None:
        update["profile_picture"] = body.profile_picture or None
    if body.bio is not None:
        update["bio"] = body.bio.strip() or None
    if body.campus is not None:
        update["campus"] = body.campus or None
    if update:
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    updated = await db.users.find_one({"id": user["id"]})
    updated = clean(updated)
    updated.pop("password_hash", None)
    return {"user": updated}


# ---------------- Notifications ----------------

@router.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    notes = await db.notifications.find({"recipient_user_id": user["id"]}).sort("created_at", -1).to_list(200)
    unread = sum(1 for n in notes if not n.get("is_read"))
    return {"notifications": [clean(n) for n in notes], "unread": unread}


@router.post("/notifications/{note_id}/read")
async def read_notification(note_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": note_id, "recipient_user_id": user["id"]}, {"$set": {"is_read": True}})
    return {"ok": True}


@router.post("/notifications/read-all")
async def read_all(user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"recipient_user_id": user["id"], "is_read": False}, {"$set": {"is_read": True}})
    return {"ok": True}


@router.delete("/notifications/{note_id}")
async def delete_notification(note_id: str, user: dict = Depends(get_current_user)):
    result = await db.notifications.delete_one(
        {"id": note_id, "recipient_user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found.")
    return {"ok": True}
