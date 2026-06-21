"""End-to-end backend tests for UTM Borrow.

Covers: auth, items, transactions, QR scan (success + every failure case),
moderation, ratings/trust, dashboard, notifications, profile.
"""
import os
import time
import uuid
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
PW = "Test1234"


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


