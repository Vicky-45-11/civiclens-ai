from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..deps import COOKIE, current_user, require_csrf_header
from ..models import Role, User
from ..ratelimit import limit
from ..schemas import LoginIn, RegisterIn, UserOut
from ..security import create_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

# Verified against when the email is unknown so response time does not reveal which emails exist.
_DUMMY = hash_password("not-a-real-password")


def _set_cookie(response: Response, user: User) -> None:
    s = get_settings()
    response.set_cookie(COOKIE, create_token(user.id, user.role), httponly=True, secure=s.cookie_secure, samesite="lax", max_age=s.jwt_ttl_minutes * 60, path="/")


@router.post("/register", response_model=UserOut, status_code=201, dependencies=[Depends(limit("auth")), Depends(require_csrf_header)])
def register(body: RegisterIn, response: Response, db: Session = Depends(get_db)) -> User:
    email = body.email.lower()
    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise HTTPException(status_code=409, detail="An account with that email already exists.")
    user = User(email=email, password_hash=hash_password(body.password), display_name=body.display_name, role=Role.resident.value)
    db.add(user)
    db.commit()
    _set_cookie(response, user)
    return user


@router.post("/login", response_model=UserOut, dependencies=[Depends(limit("auth")), Depends(require_csrf_header)])
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)) -> User:
    user = db.scalar(select(User).where(func.lower(User.email) == body.email.lower()))
    ok = verify_password(body.password, user.password_hash if user else _DUMMY)
    if not user or not ok or not user.is_active:
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    _set_cookie(response, user)
    return user


@router.post("/logout", status_code=204, dependencies=[Depends(require_csrf_header)])
def logout(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> User:
    return user
