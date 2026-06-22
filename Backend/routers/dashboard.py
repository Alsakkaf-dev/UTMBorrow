"""User Activity Dashboard (spec section 6)."""
from fastapi import APIRouter, Depends

from database import db
from security import get_current_user
from tx_common import enrich_transaction, compute_lease_flags

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
async def dashboard(user: dict = Depends(get_current_user)):
    uid = user["id"]

    borrowing_raw = await db.transactions.find({"borrower_id": uid}).to_list(500)
    lending_raw = await db.transactions.find({"lender_id": uid}).to_list(500)

    borrowing = [await enrich_transaction(t) for t in borrowing_raw]
    lending = [await enrich_transaction(t) for t in lending_raw]

    def deadline_key(t):
        return t.get("borrow_end_date") or "9999-99-99"

    borrowing.sort(key=deadline_key)

    # Granular borrow-side counters (Pending/Approved = waiting for handover; Borrowed = QR scanned)
    pending_out = sum(1 for t in borrowing_raw if t["status"] in ("Pending", "Approved"))
    active_borrowed = sum(1 for t in borrowing_raw if t["status"] == "Borrowed")

    # Granular lend-side counters
    pending_in = sum(1 for t in lending_raw if t["status"] == "Pending")
    active_lent = sum(1 for t in lending_raw if t["status"] == "Borrowed")

    # Urgent: overdue, due within 24h, OR lender flagged a return request on borrowed item
    urgent = 0
    for t in borrowing:
        if t["status"] == "Borrowed":
            lease_urgent = t.get("lease") and (t["lease"]["is_overdue"] or t["lease"]["due_within_24h"])
            return_requested = t.get("return_requested", False)
            if lease_urgent or return_requested:
                urgent += 1

    return {
        "summary": {
            # Granular (used by split dashboards)
            "pending_out": pending_out,
            "active_borrowed": active_borrowed,
            "pending_in": pending_in,
            "active_lent": active_lent,
            "urgent_returns": urgent,
            # Legacy aliases kept so old UI code doesn't break during transition
            "total_borrowing": pending_out + active_borrowed,
            "total_lending": active_lent,
            "pending_requests": pending_in,
        },
        "borrowing": borrowing,
        "lending": lending,
    }
