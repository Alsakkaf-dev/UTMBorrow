"""In-app notification center helper (now with live SSE push)."""
from database import db, new_id, now_utc, iso, clean
from realtime import broadcaster

# Allowed notification_type values (kept as a whitelist for validation)
VALID_TYPES = {
    "RequestReceived", "RequestApproved", "RequestRejected", "RequestCancelled",
    "HandoverConfirmed", "ReturnConfirmed", "ReturnReminder", "Report_Submitted",
    "Report_Reviewed", "Item_Removed", "Account_Suspended", "Account_Reinstated",
    "RatingReceived", "UserReported",
    # Admin-portal originated
    "AdminAction", "OverdueReminder", "PenaltyApplied",
}


async def notify(recipient_user_id: str, notification_type: str, message: str,
                 transaction_id: str = None, related_report_id: str = None):
    # Build and persist one notification document
    doc = {
        "id": new_id(),
        "recipient_user_id": recipient_user_id,
        "transaction_id": transaction_id,        # optional link to a transaction
        "related_report_id": related_report_id,  # optional link to a report
        "notification_type": notification_type,
        "message": message,
        "is_read": False,
        "created_at": iso(now_utc()),
    }
    await db.notifications.insert_one(doc)

    # Live push: deliver the notification + fresh unread count to the recipient.
    unread = await db.notifications.count_documents(
        {"recipient_user_id": recipient_user_id, "is_read": False})
    await broadcaster.publish_to(
        [recipient_user_id], "notification.new",
        # clean() strips Mongo's _id so the payload is JSON-safe
        {"notification": clean(dict(doc)), "unread": unread},
    )
    return doc
