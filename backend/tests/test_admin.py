from app.models import Role

from .conftest import H, client_for, jpeg, submit


def setup_issue(approve=True):
    res = client_for("r@example.com")
    staff = client_for("s@example.com", Role.staff, "Crew Lead")
    iss = submit(res).json()["issue"]
    if approve:
        assert staff.post(f"/api/admin/issues/{iss['id']}/moderate", json={"decision": "approve"}, headers=H).status_code == 200
    return res, staff, iss


def test_residents_cannot_use_admin_endpoints():
    res, _, iss = setup_issue()
    assert res.get("/api/admin/queue").status_code == 403
    assert res.post(f"/api/admin/issues/{iss['id']}/moderate", json={"decision": "approve"}, headers=H).status_code == 403
    assert res.patch(f"/api/admin/issues/{iss['id']}", json={"severity": 3}, headers=H).status_code == 403
    assert res.get("/api/admin/analytics").status_code == 403
    assert res.get("/api/admin/users").status_code == 403


def test_anonymous_cannot_use_admin_endpoints(client):
    assert client.get("/api/admin/queue").status_code == 401


def test_moderation_approve_publishes_and_reject_needs_a_reason():
    res = client_for("r@example.com")
    staff = client_for("s@example.com", Role.staff)
    a, b = submit(res).json()["issue"], submit(res, lat=13.1).json()["issue"]
    assert staff.post(f"/api/admin/issues/{b['id']}/moderate", json={"decision": "reject"}, headers=H).status_code == 422
    r = staff.post(f"/api/admin/issues/{b['id']}/moderate", json={"decision": "reject", "note": "Shows a person's face"}, headers=H)
    assert r.status_code == 200 and r.json()["status"] == "rejected"
    assert staff.post(f"/api/admin/issues/{a['id']}/moderate", json={"decision": "approve"}, headers=H).json()["status"] == "open"
    assert res.get("/api/issues").json()["total"] == 1
    assert staff.post(f"/api/admin/issues/{a['id']}/moderate", json={"decision": "approve"}, headers=H).status_code == 409
    rejected = res.get(f"/api/issues/{b['id']}").json()
    assert rejected["status"] == "rejected"
    assert all(e["type"] != "moderation" for e in rejected["events"])  # the internal reason stays internal


def test_triage_needs_confirmed_severity_and_valid_transitions():
    _, staff, iss = setup_issue()
    r = staff.patch(f"/api/admin/issues/{iss['id']}", json={"status": "triaged"}, headers=H)
    assert r.status_code == 422 and "severity" in r.json()["detail"].lower()
    ok = staff.patch(f"/api/admin/issues/{iss['id']}", json={"status": "triaged", "severity": 4, "note": "checked"}, headers=H)
    assert ok.status_code == 200 and ok.json()["status"] == "triaged" and ok.json()["severity"] == 4
    bad = staff.patch(f"/api/admin/issues/{iss['id']}", json={"status": "resolved"}, headers=H)
    assert bad.status_code == 409
    assert staff.patch(f"/api/admin/issues/{iss['id']}", json={"severity": 9}, headers=H).status_code == 422


def test_assignment_only_to_staff_and_required_for_assigned_status():
    res, staff, iss = setup_issue()
    staff.patch(f"/api/admin/issues/{iss['id']}", json={"severity": 2, "status": "triaged"}, headers=H)
    assert staff.patch(f"/api/admin/issues/{iss['id']}", json={"status": "assigned"}, headers=H).status_code == 422
    resident_id = res.get("/api/auth/me").json()["id"]
    assert staff.patch(f"/api/admin/issues/{iss['id']}", json={"assigned_to_id": resident_id}, headers=H).status_code == 422
    my_id = staff.get("/api/auth/me").json()["id"]
    r = staff.patch(f"/api/admin/issues/{iss['id']}", json={"assigned_to_id": my_id, "status": "assigned"}, headers=H)
    assert r.status_code == 200 and r.json()["assigned_to"]["id"] == my_id
    assert any(s["id"] == my_id for s in staff.get("/api/admin/staff").json())
    mine = staff.get("/api/admin/queue", params={"name": "active", "mine": "true"}).json()
    assert mine["total"] == 1


def test_resolving_requires_resolution_evidence_and_shows_it_publicly():
    res, staff, iss = setup_issue()
    my_id = staff.get("/api/auth/me").json()["id"]
    staff.patch(f"/api/admin/issues/{iss['id']}", json={"severity": 3, "assigned_to_id": my_id, "status": "assigned"}, headers=H)
    staff.patch(f"/api/admin/issues/{iss['id']}", json={"status": "in_progress"}, headers=H)
    r = staff.patch(f"/api/admin/issues/{iss['id']}", json={"status": "resolved"}, headers=H)
    assert r.status_code == 422 and "evidence" in r.json()["detail"].lower()
    ev = staff.post(f"/api/admin/issues/{iss['id']}/evidence", files=[("photos", ("f.jpg", jpeg((10, 200, 10)), "image/jpeg"))], data={"note": "Patched and sealed"}, headers=H)
    assert ev.status_code == 200 and [m["kind"] for m in ev.json()["media"]] == ["report", "resolution"]
    done = staff.patch(f"/api/admin/issues/{iss['id']}", json={"status": "resolved"}, headers=H)
    assert done.status_code == 200 and done.json()["resolved_at"]
    public = res.get(f"/api/issues/{iss['id']}").json()
    assert public["status"] == "resolved" and any(m["kind"] == "resolution" for m in public["media"])
    stats = res.get("/api/stats").json()
    assert stats["resolved"] == 1 and stats["total"] == 1
    reopened = staff.patch(f"/api/admin/issues/{iss['id']}", json={"status": "in_progress"}, headers=H)
    assert reopened.json()["resolved_at"] is None


def test_evidence_cannot_be_added_before_moderation():
    _, staff, iss = setup_issue(approve=False)
    r = staff.post(f"/api/admin/issues/{iss['id']}/evidence", files=[("photos", ("f.jpg", jpeg(), "image/jpeg"))], headers=H)
    assert r.status_code == 409
    assert staff.patch(f"/api/admin/issues/{iss['id']}", json={"severity": 2}, headers=H).status_code == 409


def test_marking_duplicate_needs_an_original():
    res, staff, iss = setup_issue()
    other = submit(res, lat=13.2).json()["issue"]
    staff.post(f"/api/admin/issues/{other['id']}/moderate", json={"decision": "approve"}, headers=H)
    r = staff.patch(f"/api/admin/issues/{other['id']}", json={"status": "duplicate"}, headers=H)
    assert r.status_code == 422
    r = staff.patch(f"/api/admin/issues/{other['id']}", json={"status": "duplicate", "duplicate_of_id": other["id"]}, headers=H)
    assert r.status_code == 422
    ok = staff.patch(f"/api/admin/issues/{other['id']}", json={"status": "duplicate", "duplicate_of_id": iss["id"]}, headers=H)
    assert ok.status_code == 200 and ok.json()["duplicate_of"] == iss["id"]


def test_internal_notes_stay_internal_and_public_notes_are_public():
    res, staff, iss = setup_issue()
    staff.patch(f"/api/admin/issues/{iss['id']}", json={"note": "Caller seems unreliable"}, headers=H)
    staff.patch(f"/api/admin/issues/{iss['id']}", json={"severity": 3, "status": "triaged", "note": "Crew scheduled", "note_is_public": True}, headers=H)
    notes = [e["note"] for e in res.get(f"/api/issues/{iss['id']}").json()["events"]]
    assert "Crew scheduled" in notes and not any("unreliable" in (n or "") for n in notes)
    staff_notes = [e["note"] for e in staff.get(f"/api/issues/{iss['id']}").json()["events"]]
    assert any("unreliable" in (n or "") for n in staff_notes)


def test_queue_sorts_flagged_and_high_severity_first_and_counts():
    res, staff, a = setup_issue()
    b = submit(res, lat=13.05).json()["issue"]
    staff.post(f"/api/admin/issues/{b['id']}/moderate", json={"decision": "approve"}, headers=H)
    staff.patch(f"/api/admin/issues/{b['id']}", json={"severity": 5, "status": "triaged"}, headers=H)
    q = staff.get("/api/admin/queue", params={"name": "triage"}).json()
    assert [i["id"] for i in q["items"]][0] == b["id"]
    counts = staff.get("/api/admin/queue-counts").json()
    assert counts["triage"] == 2 and counts["moderation"] == 0


def test_only_admin_changes_roles_and_not_their_own():
    admin = client_for("a@example.com", Role.admin, "Boss")
    res = client_for("r@example.com")
    uid = res.get("/api/auth/me").json()["id"]
    assert res.patch(f"/api/admin/users/{uid}/role", json={"role": "admin"}, headers=H).status_code == 403
    r = admin.patch(f"/api/admin/users/{uid}/role", json={"role": "staff", "department": "Water"}, headers=H)
    assert r.status_code == 200 and r.json()["role"] == "staff"
    assert res.get("/api/admin/queue").status_code == 200
    me = admin.get("/api/auth/me").json()["id"]
    assert admin.patch(f"/api/admin/users/{me}/role", json={"role": "resident"}, headers=H).status_code == 409
    assert admin.patch(f"/api/admin/users/{uid}/role", json={"role": "root"}, headers=H).status_code == 422


def test_analytics_come_from_the_database():
    res, staff, a = setup_issue()
    data = staff.get("/api/admin/analytics").json()
    assert data["by_status"] == {"open": 1}
    assert sum(d["count"] for d in data["daily_last_30_days"]) == 1
    assert data["median_days_to_resolve"] is None
    assert data["ai_agreement"] == {"judged": 0, "matched": 0}  # demo mode makes no predictions, so nothing is claimed
    assert data["hotspots"][0]["count"] == 1
    empty = client_for("a2@example.com", Role.admin)
    assert empty.get("/api/stats").json()["total"] == 1


def test_health_endpoint(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["ai_mode"] == "demo"
