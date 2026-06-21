"""UTM Borrow — FastAPI application entrypoint."""
import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import db
from seed import seed, ensure_indexes
from routers import (
    auth, items, transactions, qr, ratings, profile, dashboard, moderation,
    events, admin, chat, support, saved,
)

app = FastAPI(title="UTM Borrow API")

# Comma-separated allowlist from env. Trim whitespace and drop empties so a
# value like "https://a.com, https://b.com" doesn't break the second origin
# with a stray leading space (a silent CORS-preflight failure).
origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "utm-borrow"}


app.include_router(auth.router)
app.include_router(items.router)
app.include_router(transactions.router)
app.include_router(qr.router)
app.include_router(ratings.router)
app.include_router(profile.router)
app.include_router(dashboard.router)
app.include_router(moderation.router)
app.include_router(events.router)
app.include_router(admin.router)
app.include_router(chat.router)
app.include_router(support.router)
app.include_router(saved.router)


@app.on_event("startup")
async def startup():
    try:
        await ensure_indexes()
    except Exception as e:
        print("Index setup warning:", e)
    await seed()
    print("UTM Borrow API ready.")
