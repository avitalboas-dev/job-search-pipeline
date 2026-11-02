import hashlib
import hmac
import os
import time
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

APP_PASSWORD = os.environ.get("APP_PASSWORD")
ON_RAILWAY = bool(os.environ.get("RAILWAY_ENVIRONMENT") or os.environ.get("RAILWAY_ENVIRONMENT_NAME"))

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _token() -> bytes:
    # Derived from the password, so changing APP_PASSWORD signs everyone out
    return hmac.new(APP_PASSWORD.encode(), b"job-search-crm", hashlib.sha256).hexdigest().encode()


def require_auth(authorization: Optional[str] = Header(default=None)):
    if not APP_PASSWORD:
        # Local dev runs open; a hosted deploy with no password must lock, not unlock
        if ON_RAILWAY:
            raise HTTPException(status_code=503, detail="Server is missing APP_PASSWORD.")
        return
    supplied = (authorization or "").removeprefix("Bearer ").encode()
    if not hmac.compare_digest(supplied, _token()):
        raise HTTPException(status_code=401, detail="Not signed in.")


class LoginRequest(BaseModel):
    password: str


@router.post("/login")
def login(body: LoginRequest):
    if not APP_PASSWORD:
        if ON_RAILWAY:
            raise HTTPException(status_code=503, detail="Server is missing APP_PASSWORD.")
        return {"token": ""}
    if not hmac.compare_digest(body.password.encode(), APP_PASSWORD.encode()):
        time.sleep(1)  # slows down password guessing
        raise HTTPException(status_code=401, detail="Incorrect password.")
    return {"token": _token().decode()}


@router.get("/check")
def check(authorization: Optional[str] = Header(default=None)):
    require_auth(authorization)
    return {"ok": True}
