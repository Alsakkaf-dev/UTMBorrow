"""Shared helpers for transactions: state logging, trust recompute, lease status."""
from datetime import date

from database import db, new_id, now_utc, iso, clean


async def log_transition(transaction_id, prev, new, by, reason=None):
    await db.transaction_state_logs.insert_one({
        "id": new_id(), "transaction_id": transaction_id,
        "previous_status": prev, "new_status": new,
        "changed_by_user_id": by, "change_reason": reason,
        "created_at": iso(now_utc()),
    })


async def recompute_trust_score(user_id: str) -> float:
    ratings = await db.user_ratings.find({"ratee_id": user_id}).to_list(1000)
    if not ratings:
        return None
    avg = round(sum(r["stars"] for r in ratings) / len(ratings), 2)
    await db.users.update_one({"id": user_id}, {"$set": {"trust_score": avg}})
    return avg


def compute_lease_flags(expected_return_date: str):
    """Return (is_overdue, due_within_24h, overdue_days) for a date string YYYY-MM-DD."""
    if not expected_return_date:
        return False, False, 0
    try:
        exp = date.fromisoformat(expected_return_date)
    except Exception:
        return False, False, 0
    today = date.today()
    delta = (exp - today).days
    overdue_days = max(0, -delta)
    is_overdue = delta < 0
    due_within_24h = 0 <= delta <= 1
    return is_overdue, due_within_24h, overdue_days


async def enrich_transaction(tx: dict) -> dict:
    tx = clean(tx)
    item = await db.items.find_one({"id": tx["item_id"]})
    borrower = await db.users.find_one({"id": tx["borrower_id"]})
    lender = await db.users.find_one({"id": tx["lender_id"]})
    tx["item"] = {"id": item["id"], "title": item["title"], "photo_url": item.get("photo_url"),
                  "category": item.get("category"),
                  "visibility": item.get("visibility", "Public")} if item else {"id": tx["item_id"], "title": "(removed item)"}
    
    
    
    # trust_score is None when the user has no ratings yet — callers should display "N/A" not a hardcoded value
    tx["borrower"] = {"id": borrower["id"], "full_name": borrower["full_name"],
                      "trust_score": borrower.get("trust_score"),
                      "profile_picture": borrower.get("profile_picture")} if borrower else None
    tx["lender"] = {"id": lender["id"], "full_name": lender["full_name"],
                    "trust_score": lender.get("trust_score"),
                    "profile_picture": lender.get("profile_picture")} if lender else None
    lease = await db.lease_cycles.find_one({"transaction_id": tx["id"]})
    if lease:
        is_overdue, due_soon, overdue_days = compute_lease_flags(lease.get("expected_return_date"))
        tx["lease"] = {"lease_status": lease["lease_status"],
                       "expected_return_date": lease.get("expected_return_date"),
                       "is_overdue": is_overdue, "due_within_24h": due_soon,
                       "overdue_days": overdue_days}
    else:
        tx["lease"] = None
    tx["return_requested"] = tx.get("return_requested", False)
    return tx
