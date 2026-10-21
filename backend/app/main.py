import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .ai.classifier import get_classifier
from .config import get_settings
from .db import get_engine
from .models import Role, User
from .routers import admin, analytics, auth, issues
from .security import hash_password

log = logging.getLogger("civiclens")
DEV_SECRET = "dev-only-change-me-dev-only-change-me"


def ensure_admin(s) -> None:
    """Create the first admin from ADMIN_EMAIL / ADMIN_PASSWORD. Never touches an existing account."""
    if not (s.admin_email and s.admin_password):
        return
    if len(s.admin_password) < 12:
        raise RuntimeError("ADMIN_PASSWORD must be at least 12 characters.")
    with Session(get_engine()) as db:
        email = s.admin_email.strip().lower()
        if db.scalar(select(User).where(User.email == email)):
            return
        db.add(User(email=email, password_hash=hash_password(s.admin_password), display_name="Administrator", role=Role.admin.value))
        db.commit()
        log.info("Created initial admin account %s", email)


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    if s.app_env != "development" and (s.jwt_secret == DEV_SECRET or len(s.jwt_secret) < 32):
        raise RuntimeError("Set JWT_SECRET to a random value of at least 32 characters before running outside development.")
    ensure_admin(s)
    clf = get_classifier()
    if clf.error:
        log.warning("AI model: %s", clf.error)
    log.info("AI model: %s", clf.name if clf.loaded else "none loaded (demo mode)")
    yield


app = FastAPI(title="CivicLens AI API", version="1.0.0", lifespan=lifespan)

s0 = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=s0.origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-Requested-With"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    if request.url.path.startswith("/api/auth"):
        response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on our side."})


for r in (auth.router, issues.router, admin.router, analytics.router):
    app.include_router(r, prefix="/api")


@app.get("/api/health", tags=["meta"])
def health():
    with get_engine().connect() as c:
        c.execute(text("select 1"))
    clf = get_classifier()
    return {"status": "ok", "database": "ok", "ai_model": clf.name if clf.loaded else None, "ai_mode": "model" if clf.loaded else "demo"}
