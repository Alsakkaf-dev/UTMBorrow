"""Ratings & Trust Score (spec section 6)."""
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from database import db, new_id, now_utc, iso, clean
from security import get_current_user
from notifications import notify
from tx_common import recompute_trust_score

router = APIRouter(prefix="/api/ratings", tags=["ratings"])


class RatingIn(BaseModel):
    transaction_id: str
    stars: int = Field(ge=1, le=5)
    feedback: Optional[str] = Field(default=None, max_length=500)


# Rating window (SRS UC1202 / UC3203 step 12):
#   Both parties may rate ONLY after the loan is Completed (the item was
#   physically returned and QR-verified). This is a single, mutual rating
#   moment — it prevents an early borrower rating from colliding with the
#   post-return prompt ("You already rated this transaction"). A
#   cancelled/rejected deal never reaches Completed, so no rating is possible.
def _rating_eligibility(user_id: str, tx: dict):
    status = tx.get("status")
    completed = status == "Completed"
    if user_id == tx["borrower_id"]:
        return {"role": "borrower", "ratee_id": tx["lender_id"], "allowed": completed,
                "reason": None if completed else "You can rate your lender after the item is returned."}
    if user_id == tx["lender_id"]:
        return {"role": "lender", "ratee_id": tx["borrower_id"], "allowed": completed,
                "reason": None if completed else "You can rate your borrower after the item is returned."}
    return {"role": None, "ratee_id": None, "allowed": False, "reason": "Not your transaction."}


@router.get("/transaction/{tx_id}/eligibility")
async def rating_eligibility(tx_id: str, user: dict = Depends(get_current_user)):
    tx = await db.transactions.find_one({"id": tx_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    elig = _rating_eligibility(user["id"], tx)
    already = await db.user_ratings.find_one({"transaction_id": tx_id, "rater_id": user["id"]})
    return {**elig, "already_rated": bool(already)}


@router.get("/pending")
async def pending_ratings(user: dict = Depends(get_current_user)):
    """SRS UC1202 (incl. A1 "remind me later"): the current user's outstanding
    rating actions — Completed transactions where they are rating-eligible but
    have not yet submitted a rating. Enriched with the counterparty + item."""
    uid = user["id"]
    txs = await db.transactions.find(
        {"status": "Completed", "$or": [{"borrower_id": uid}, {"lender_id": uid}]}
    ).sort("updated_at", -1).to_list(500)
    out = []
    for tx in txs:
        elig = _rating_eligibility(uid, tx)
        if not elig["allowed"] or not elig["ratee_id"]:
            continue
        if await db.user_ratings.find_one({"transaction_id": tx["id"], "rater_id": uid}):
            continue
        counterparty = await db.users.find_one({"id": elig["ratee_id"]})
        item = await db.items.find_one({"id": tx.get("item_id")})
        out.append({
            "transaction_id": tx["id"],
            "role": elig["role"],
            "counterparty": {
                "id": counterparty["id"], "full_name": counterparty["full_name"],
                "profile_picture": counterparty.get("profile_picture"),
            } if counterparty else None,
            "item_title": item["title"] if item else "(removed item)",
            "item_photo_url": item.get("photo_url") if item else None,
            "completed_at": tx.get("updated_at") or tx.get("created_at"),
        })
    return {"pending": out, "count": len(out)}


@router.post("")
async def submit_rating(body: RatingIn, user: dict = Depends(get_current_user)):
    tx = await db.transactions.find_one({"id": body.transaction_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    if user["id"] not in (tx["borrower_id"], tx["lender_id"]):
        raise HTTPException(status_code=403, detail="Not your transaction.")
    elig = _rating_eligibility(user["id"], tx)
    if not elig["allowed"]:
        raise HTTPException(status_code=400, detail=elig["reason"] or "Rating not available yet.")
    ratee_id = elig["ratee_id"]
    if ratee_id == user["id"]:
        raise HTTPException(status_code=400, detail="You cannot rate yourself.")
    if await db.user_ratings.find_one({"transaction_id": body.transaction_id, "rater_id": user["id"]}):
        raise HTTPException(status_code=400, detail="You already rated this transaction.")

    rating = {
        "id": new_id(), "rater_id": user["id"], "ratee_id": ratee_id,
        "transaction_id": body.transaction_id,
        "item_id": tx.get("item_id"),   # persist per-post so we can aggregate per item
        "stars": body.stars,
        "feedback": (body.feedback or "").strip() or None, "created_at": iso(now_utc()),
    }
    await db.user_ratings.insert_one(rating)
    new_avg = await recompute_trust_score(ratee_id)
    await notify(ratee_id, "RatingReceived",
                 f"You received a {body.stars}-star rating.", transaction_id=body.transaction_id)
    return {"rating": clean(rating), "new_trust_score": new_avg}


@router.get("/transaction/{tx_id}/mine")
async def my_rating_for(tx_id: str, user: dict = Depends(get_current_user)):
    r = await db.user_ratings.find_one({"transaction_id": tx_id, "rater_id": user["id"]})
    return {"rated": bool(r), "rating": clean(r) if r else None}


@router.get("/user/{user_id}")
async def user_ratings(user_id: str):
    ratings = await db.user_ratings.find({"ratee_id": user_id}).sort("created_at", -1).to_list(200)
    out = []
    for r in ratings:
        rater = await db.users.find_one({"id": r["rater_id"]})
        r = clean(r)
        r["rater_name"] = rater["full_name"] if rater else "Unknown"
        out.append(r)
    return {"ratings": out, "count": len(out)}


@router.get("/item/{item_id}")
async def item_ratings(item_id: str):
    """Per-post rating aggregate — count, average, and recent reviews."""
    ratings = await db.user_ratings.find({"item_id": item_id}).sort("created_at", -1).to_list(200)
    count = len(ratings)
    average = round(sum(r["stars"] for r in ratings) / count, 2) if count else None
    recent = []
    for r in ratings[:10]:
        rater = await db.users.find_one({"id": r["rater_id"]})
        rc = clean(r)
        rc["rater_name"] = rater["full_name"] if rater else "Unknown"
        recent.append(rc)
    return {"count": count, "average": average, "recent": recent}
