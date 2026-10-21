from .conftest import PASSWORD, H, client_for, make_user


def test_register_login_me_logout(client):
    r = client.post("/api/auth/register", json={"email": "A@Example.com", "password": PASSWORD, "display_name": "  Asha   K "}, headers=H)
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "a@example.com" and body["role"] == "resident" and body["display_name"] == "Asha K"
    assert "password" not in str(body).lower()
    assert client.get("/api/auth/me").json()["email"] == "a@example.com"
    assert "httponly" in r.headers["set-cookie"].lower()
    client.post("/api/auth/logout", headers=H)
    assert client.get("/api/auth/me").status_code == 401


def test_duplicate_email_and_weak_password(client):
    ok = {"email": "a@example.com", "password": PASSWORD, "display_name": "A"}
    assert client.post("/api/auth/register", json=ok, headers=H).status_code == 201
    assert client.post("/api/auth/register", json={**ok, "email": "A@EXAMPLE.com"}, headers=H).status_code == 409
    assert client.post("/api/auth/register", json={**ok, "email": "b@example.com", "password": "short"}, headers=H).status_code == 422
    assert client.post("/api/auth/register", json={**ok, "email": "not-an-email"}, headers=H).status_code == 422


def test_wrong_password_and_unknown_email_look_the_same(client):
    make_user("a@example.com")
    r1 = client.post("/api/auth/login", json={"email": "a@example.com", "password": "wrong-password-1"}, headers=H)
    r2 = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "wrong-password-1"}, headers=H)
    assert r1.status_code == r2.status_code == 401
    assert r1.json() == r2.json()


def test_state_changing_requests_need_the_custom_header(client):
    r = client.post("/api/auth/login", json={"email": "a@example.com", "password": PASSWORD})
    assert r.status_code == 403


def test_forged_token_is_rejected(client):
    client.cookies.set("civiclens_session", "not.a.jwt")
    assert client.get("/api/auth/me").status_code == 401


def test_deactivated_user_cannot_use_old_session():
    from app.db import get_db
    from app.models import User

    c = client_for("a@example.com")
    assert c.get("/api/auth/me").status_code == 200
    db = next(get_db())
    u = db.query(User).filter_by(email="a@example.com").one()
    u.is_active = False
    db.commit()
    assert c.get("/api/auth/me").status_code == 401


def test_auth_rate_limit(monkeypatch, client):
    from app.config import get_settings

    monkeypatch.setenv("RATE_LIMIT_AUTH_PER_MIN", "3")
    get_settings.cache_clear()
    codes = [client.post("/api/auth/login", json={"email": "x@example.com", "password": "wrong-password-1"}, headers=H).status_code for _ in range(5)]
    assert codes[:3] == [401, 401, 401] and codes[3:] == [429, 429]
    r = client.post("/api/auth/login", json={"email": "x@example.com", "password": "wrong-password-1"}, headers=H)
    assert "retry-after" in {k.lower() for k in r.headers}


def test_initial_admin_bootstrap_creates_once_and_keeps_existing_password(client, monkeypatch):
    import pytest
    from sqlalchemy.orm import Session

    from app.config import get_settings
    from app.db import get_engine
    from app.main import ensure_admin
    from app.models import User

    s = get_settings()
    monkeypatch.setattr(s, "admin_email", "Boss@Example.com")
    monkeypatch.setattr(s, "admin_password", "a-long-admin-password")
    ensure_admin(s)
    c = client
    assert c.post("/api/auth/login", json={"email": "boss@example.com", "password": "a-long-admin-password"}, headers=H).status_code == 200
    assert c.get("/api/auth/me").json()["role"] == "admin"
    monkeypatch.setattr(s, "admin_password", "a-different-password!")
    ensure_admin(s)  # existing account is left alone
    with Session(get_engine()) as db:
        assert db.query(User).filter_by(email="boss@example.com").count() == 1
    monkeypatch.setattr(s, "admin_password", "short")
    with pytest.raises(RuntimeError):
        ensure_admin(s)
