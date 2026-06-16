"""Server-Sent Events stream — pushes live updates to connected clients.

The browser's EventSource cannot send Authorization headers, so the JWT is
passed as a `?token=` query param and verified here. Each connection registers
with the in-process `broadcaster`; events are streamed as they are published by
the other routers (items / transactions / qr / notifications / moderation).
"""
import asyncio
import json

import jwt
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from database import db
from security import JWT_ALGORITHM, _secret
from realtime import broadcaster

router = APIRouter(prefix="/api", tags=["events"])


HEARTBEAT_SECONDS = 20


async def _user_from_token(token: str | None) -> dict | None:
    if not token:
        return None
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        return None
    user = await db.users.find_one({"id": payload.get("sub")})
    if not user:
        return None
    return user


def _format(event: dict) -> str:
    return f"event: {event['type']}\ndata: {json.dumps(event['payload'])}\n\n"


@router.get("/events")
async def events(request: Request, token: str | None = None):
    user = await _user_from_token(token)
    if not user:
        async def _deny():
            yield "event: auth_error\ndata: {}\n\n"
        return StreamingResponse(_deny(), media_type="text/event-stream")

    user_id = user["id"]
    queue = await broadcaster.subscribe(user_id)

    async def stream():
        try:
            yield "event: connected\ndata: {}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
                    yield _format(event)
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            await broadcaster.unsubscribe(user_id, queue)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
