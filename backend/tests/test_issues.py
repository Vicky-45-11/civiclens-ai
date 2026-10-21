import io

from PIL import Image

from app.models import Role

from .conftest import H, client_for, jpeg, submit


def test_submit_requires_login(client):
    assert submit(client).status_code == 401


def test_submit_creates_pending_report_with_demo_ai_labelled():
    c = client_for("r@example.com")
    r = submit(c, description="Big hole")
    assert r.status_code == 201, r.text
    issue = r.json()["issue"]
    assert issue["status"] == "pending_review"
    assert issue["tracking_code"].startswith("CL-")
    assert issue["ai"]["is_demo"] is True and issue["ai"]["confidence"] is None
    assert 1 <= issue["ai"]["severity"] <= 5
    assert issue["severity"] is None  # the human decision is empty until triage
    assert issue["media"] and issue["events"][0]["type"] == "submitted"


def test_pending_reports_are_private_until_approved():
    r = client_for("r@example.com")
    other = client_for("o@example.com")
    anon = client_for("x@example.com")
    created = submit(r).json()["issue"]
    assert r.get(f"/api/issues/{created['id']}").status_code == 200
    assert other.get(f"/api/issues/{created['id']}").status_code == 404
    assert other.get("/api/issues").json()["total"] == 0
    assert other.get(created["media"][0]["url"]).status_code == 404
    assert r.get(created["media"][0]["url"]).status_code == 200
    assert r.get("/api/issues", params={"mine": "true"}).json()["total"] == 1
    anon.close()


def test_exif_gps_is_stripped_from_stored_photo():
    c = client_for("r@example.com")
    raw = jpeg(exif_gps=True)
    assert Image.open(io.BytesIO(raw)).getexif().get(0x010F) == "TestCam"
    issue = submit(c, photo=raw).json()["issue"]
    stored = c.get(issue["media"][0]["url"]).content
    img = Image.open(io.BytesIO(stored))
    assert len(img.getexif()) == 0 and "exif" not in img.info


def test_invalid_inputs_are_rejected():
    c = client_for("r@example.com")
    assert submit(c, lat=95).status_code == 422
    assert submit(c, lon=200).status_code == 422
    assert submit(c, category="graffiti").status_code == 422
    assert submit(c, title="ab").status_code == 422
    bad = c.post("/api/issues", data={"category": "pothole", "title": "Hole here", "lat": "1", "lon": "1"}, files=[("photos", ("x.jpg", b"not an image", "image/jpeg"))], headers=H)
    assert bad.status_code == 422 and "photo" in bad.json()["detail"].lower()
    gif = io.BytesIO()
    Image.new("RGB", (100, 100)).save(gif, format="GIF")
    r = c.post("/api/issues", data={"category": "pothole", "title": "Hole here", "lat": "1", "lon": "1"}, files=[("photos", ("x.gif", gif.getvalue(), "image/gif"))], headers=H)
    assert r.status_code == 422
    tiny = c.post("/api/issues", data={"category": "pothole", "title": "Hole here", "lat": "1", "lon": "1"}, files=[("photos", ("x.jpg", jpeg(size=(20, 20)), "image/jpeg"))], headers=H)
    assert tiny.status_code == 422


def test_upload_size_and_count_limits(monkeypatch):
    from app.config import get_settings

    c = client_for("r@example.com")
    monkeypatch.setenv("MAX_UPLOAD_BYTES", "500")
    get_settings.cache_clear()
    assert submit(c).status_code == 413
    monkeypatch.setenv("MAX_UPLOAD_BYTES", str(6 * 1024 * 1024))
    monkeypatch.setenv("MAX_PHOTOS_PER_ISSUE", "1")
    get_settings.cache_clear()
    two = [("photos", ("a.jpg", jpeg(), "image/jpeg")), ("photos", ("b.jpg", jpeg(), "image/jpeg"))]
    r = c.post("/api/issues", data={"category": "pothole", "title": "Hole here", "lat": "1", "lon": "1"}, files=two, headers=H)
    assert r.status_code == 422


def test_text_is_cleaned_and_html_is_not_interpreted():
    c = client_for("r@example.com")
    issue = submit(c, title="<b>Hole</b>\x00 here", description="x" * 5000).json()["issue"]
    assert "\x00" not in issue["title"] and issue["title"] == "<b>Hole</b> here"  # stored as plain text; the UI escapes it
    assert len(issue["description"]) == 2000


def test_submit_rate_limit(monkeypatch):
    from app.config import get_settings

    c = client_for("r@example.com")
    monkeypatch.setenv("RATE_LIMIT_SUBMIT_PER_MIN", "2")
    get_settings.cache_clear()
    codes = [submit(c, lat=10 + i * 0.1).status_code for i in range(3)]
    assert codes == [201, 201, 429]


def test_preview_returns_suggestion_and_duplicates_without_saving():
    c = client_for("r@example.com")
    staff = client_for("s@example.com", Role.staff)
    first = submit(c).json()["issue"]
    staff.post(f"/api/admin/issues/{first['id']}/moderate", json={"decision": "approve"}, headers=H)
    r = c.post("/api/issues/preview", data={"lat": "12.97", "lon": "80.04", "category": "pothole"}, files=[("photos", ("p.jpg", jpeg(), "image/jpeg"))], headers=H)
    assert r.status_code == 200
    body = r.json()
    assert body["ai"]["is_demo"] is True and body["ai"]["category"] == "pothole"
    assert len(body["duplicates"]) == 1 and body["duplicates"][0]["tracking_code"] == first["tracking_code"] and body["duplicates"][0]["likely"]
    assert c.get("/api/issues", params={"mine": "true"}).json()["total"] == 1  # nothing new was stored


def test_duplicate_detection_ignores_other_categories_and_far_away_reports():
    c = client_for("r@example.com")
    submit(c, category="pothole")
    near_other_category = submit(c, category="water_leak").json()
    far = submit(c, lat=13.5, lon=80.5).json()
    assert near_other_category["duplicates"] == [] and far["duplicates"] == []
    same = submit(c, category="pothole", lat=12.97003).json()
    assert len(same["duplicates"]) == 1 and same["duplicates"][0]["distance_m"] < 10


def test_flagging_and_privacy_of_flags():
    c = client_for("r@example.com")
    staff = client_for("s@example.com", Role.staff)
    other = client_for("o@example.com")
    issue = submit(c).json()["issue"]
    assert other.post(f"/api/issues/{issue['id']}/flag", json={"reason": "wrong place"}, headers=H).status_code == 404  # not public yet
    staff.post(f"/api/admin/issues/{issue['id']}/moderate", json={"decision": "approve"}, headers=H)
    assert other.post(f"/api/issues/{issue['id']}/flag", json={"reason": "contains a face"}, headers=H).status_code == 204
    assert other.post(f"/api/issues/{issue['id']}/flag", json={"reason": "again"}, headers=H).status_code == 409
    assert staff.get(f"/api/issues/{issue['id']}").json()["flag_count"] == 1
    public_view = other.get(f"/api/issues/{issue['id']}").json()
    assert all(e["is_public"] for e in public_view["events"]) and public_view["reporter"] is None


def test_clusters_group_nearby_points_and_split_when_zoomed_in():
    c = client_for("r@example.com")
    staff = client_for("s@example.com", Role.staff)
    for i in range(3):
        iss = submit(c, lat=12.9700 + i * 0.0003, lon=80.0400, title=f"Near {i}").json()["issue"]
        staff.post(f"/api/admin/issues/{iss['id']}/moderate", json={"decision": "approve"}, headers=H)
    far = submit(c, lat=12.99, lon=80.06, title="Far one").json()["issue"]
    staff.post(f"/api/admin/issues/{far['id']}/moderate", json={"decision": "approve"}, headers=H)
    bbox = "80.0,12.9,80.1,13.0"
    low = c.get("/api/issues/clusters", params={"bbox": bbox, "zoom": 14}).json()
    assert sorted(x["count"] for x in low) == [1, 3]
    assert [x for x in low if x["count"] == 1][0]["issue_id"] == far["id"]
    high = c.get("/api/issues/clusters", params={"bbox": bbox, "zoom": 19}).json()
    assert sum(x["count"] for x in high) == 4 and len(high) == 4
    assert c.get("/api/issues/clusters", params={"bbox": "bad", "zoom": 5}).status_code == 422
    assert c.get("/api/issues/clusters", params={"bbox": "1,1,0,0", "zoom": 5}).status_code == 422


def test_list_filters_search_and_pagination():
    c = client_for("r@example.com")
    staff = client_for("s@example.com", Role.staff)
    for i in range(5):
        iss = submit(c, category="pothole" if i < 3 else "streetlight", title=f"Report number {i}", lat=12.97 + i * 0.01).json()["issue"]
        staff.post(f"/api/admin/issues/{iss['id']}/moderate", json={"decision": "approve"}, headers=H)
    assert c.get("/api/issues", params={"category": "streetlight"}).json()["total"] == 2
    assert c.get("/api/issues", params={"q": "number 4"}).json()["total"] == 1
    page = c.get("/api/issues", params={"page_size": 2, "page": 3}).json()
    assert page["total"] == 5 and len(page["items"]) == 1
    assert c.get("/api/issues", params={"category": "x"}).status_code == 422
    assert c.get("/api/issues", params={"status": "x"}).status_code == 422
    assert c.get("/api/issues", params={"page_size": 1000}).status_code == 422
    assert c.get("/api/issues", params={"q": "100%_"}).status_code == 200  # wildcard characters are not interpreted


def test_lookup_by_tracking_code_and_unknown_id():
    c = client_for("r@example.com")
    issue = submit(c).json()["issue"]
    assert c.get(f"/api/issues/{issue['tracking_code'].lower()}").json()["id"] == issue["id"]
    assert c.get("/api/issues/does-not-exist").status_code == 404
