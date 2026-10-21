"""Tests run against a real PostgreSQL + PostGIS database (TEST_DATABASE_URL). They never touch DATABASE_URL."""

import io
import os
import tempfile

import pytest
from PIL import Image

TEST_DB = os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg://postgres@127.0.0.1:5433/civiclens_test")
os.environ["DATABASE_URL"] = TEST_DB
os.environ["STORAGE_DIR"] = tempfile.mkdtemp(prefix="civiclens-test-")
os.environ["APP_ENV"] = "development"
os.environ["RATE_LIMIT_AUTH_PER_MIN"] = "1000"
os.environ["RATE_LIMIT_SUBMIT_PER_MIN"] = "1000"
os.environ["RATE_LIMIT_WRITE_PER_MIN"] = "1000"
os.environ["RATE_LIMIT_READ_PER_MIN"] = "100000"
os.environ.pop("MODEL_PATH", None)

from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text

from alembic import command
from app.ai.classifier import reset_classifier
from app.config import get_settings
from app.db import get_engine, reset_engine
from app.main import app
from app.models import Role, User
from app.ratelimit import limiter
from app.security import hash_password
from app.storage import reset_storage

H = {"X-Requested-With": "civiclens"}
PASSWORD = "correct-horse-battery"


@pytest.fixture(scope="session", autouse=True)
def schema():
    get_settings.cache_clear()
    reset_engine()
    command.upgrade(Config("alembic.ini"), "head")
    yield
    reset_engine()


@pytest.fixture(autouse=True)
def clean():
    get_settings.cache_clear()
    reset_storage()
    reset_classifier()
    limiter.reset()
    with get_engine().begin() as c:
        c.execute(text("TRUNCATE flags, issue_events, media, issues, users RESTART IDENTITY CASCADE"))
    yield


@pytest.fixture
def client():
    with TestClient(app, base_url="http://localhost") as c:
        yield c


def make_user(email: str, role: Role = Role.resident, name: str = "Tester") -> User:
    from app.db import get_db

    db = next(get_db())
    u = User(email=email, password_hash=hash_password(PASSWORD), display_name=name, role=role.value)
    db.add(u)
    db.commit()
    return u


def login(client: TestClient, email: str) -> TestClient:
    r = client.post("/api/auth/login", json={"email": email, "password": PASSWORD}, headers=H)
    assert r.status_code == 200, r.text
    return client


def client_for(email: str, role: Role = Role.resident, name: str = "Tester") -> TestClient:
    make_user(email, role, name)
    c = TestClient(app, base_url="http://localhost")
    c.__enter__()
    login(c, email)
    return c


def jpeg(color=(120, 90, 60), size=(200, 150), exif_gps: bool = False, fmt: str = "JPEG") -> bytes:
    img = Image.new("RGB", size, color)
    for x in range(0, size[0], 7):  # some texture so hashes differ between colours
        for y in range(0, size[1], 11):
            img.putpixel((x, y), (255 - color[0], color[1], color[2]))
    out = io.BytesIO()
    if exif_gps:
        exif = Image.Exif()
        exif[0x010F] = "TestCam"  # make
        exif[0x8825] = {1: "N", 2: (12.0, 58.0, 18.0), 3: "E", 4: (80.0, 2.0, 38.0)}  # GPS IFD
        img.save(out, format=fmt, exif=exif)
    else:
        img.save(out, format=fmt)
    return out.getvalue()


def submit(c: TestClient, lat=12.97, lon=80.04, category="pothole", title="Deep pothole", photo: bytes | None = None, **extra):
    files = [("photos", ("p.jpg", photo or jpeg(), "image/jpeg"))]
    data = {"category": category, "title": title, "lat": str(lat), "lon": str(lon), **extra}
    return c.post("/api/issues", data=data, files=files, headers=H)
