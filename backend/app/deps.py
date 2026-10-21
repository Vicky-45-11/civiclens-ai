import uuid

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .db import get_db
from .models import Role, User
from .security import decode_token

COOKIE = "civiclens_session"


def optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    token = request.cookies.get(COOKIE)
    if not token:
        auth = request.headers.get("authorization", "")
        token = auth[7:] if auth.lower().startswith("bearer ") else None
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    try:
        user = db.get(User, uuid.UUID(payload["sub"]))
    except (KeyError, ValueError):
        return None
    return user if user and user.is_active else None


def current_user(user: User | None = Depends(optional_user)) -> User:
    if user is None:
        raise HTTPException(status_code=401, detail="Please sign in.")
    return user


def require_csrf_header(request: Request) -> None:
    """State-changing requests must carry a custom header, which cross-site forms cannot send."""
    if request.method not in ("GET", "HEAD", "OPTIONS") and request.headers.get("x-requested-with") != "civiclens":
        raise HTTPException(status_code=403, detail="Missing request header.")


def staff_user(user: User = Depends(current_user)) -> User:
    if user.role not in (Role.staff.value, Role.admin.value):
        raise HTTPException(status_code=403, detail="Staff access required.")
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if user.role != Role.admin.value:
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user
