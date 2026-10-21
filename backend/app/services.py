"""Shared helpers: serialization, event logging and the status workflow."""

import uuid

from fastapi import HTTPException
from geoalchemy2 import Geometry
from sqlalchemy import cast, func, select
from sqlalchemy.orm import Session

from .models import PUBLIC_STATUSES, Issue, IssueEvent, Media, Role, Status, User
from .schemas import AiOut, EventOut, IssueDetail, IssueSummary, MediaOut, StaffOut

PUBLIC_VALUES = [s.value for s in PUBLIC_STATUSES]

# Allowed moves. pending_review is left only through moderation (see routers/admin.py).
TRANSITIONS: dict[str, set[str]] = {
    Status.open.value: {Status.triaged.value, Status.assigned.value, Status.in_progress.value, Status.duplicate.value},
    Status.triaged.value: {Status.open.value, Status.assigned.value, Status.in_progress.value, Status.duplicate.value},
    Status.assigned.value: {Status.triaged.value, Status.in_progress.value, Status.resolved.value, Status.duplicate.value},
    Status.in_progress.value: {Status.assigned.value, Status.resolved.value},
    Status.resolved.value: {Status.in_progress.value},
    Status.duplicate.value: {Status.open.value},
}


def is_staff(user: User | None) -> bool:
    return user is not None and user.role in (Role.staff.value, Role.admin.value)


def lat_lon(db: Session, issue: Issue) -> tuple[float, float]:
    geom = cast(Issue.location, Geometry)
    row = db.execute(select(func.ST_Y(geom), func.ST_X(geom)).where(Issue.id == issue.id)).one()
    return float(row[0]), float(row[1])


def add_event(db: Session, issue: Issue, type_: str, actor: User | None, note: str | None = None, from_status: str | None = None, to_status: str | None = None, is_public: bool = True) -> IssueEvent:
    ev = IssueEvent(issue_id=issue.id, actor_id=actor.id if actor else None, type=type_, note=note, from_status=from_status, to_status=to_status, is_public=is_public)
    db.add(ev)
    return ev


def media_url(m: Media) -> str:
    return f"/api/media/{m.id}"


def can_view(issue: Issue, user: User | None) -> bool:
    if issue.status in PUBLIC_VALUES:
        return True
    return is_staff(user) or (user is not None and issue.reporter_id == user.id)


def summary(db: Session, issue: Issue, coords: tuple[float, float] | None = None) -> IssueSummary:
    lat, lon = coords or lat_lon(db, issue)
    first = next((m for m in issue.media if m.kind == "report"), None)
    return IssueSummary(
        id=issue.id, tracking_code=issue.tracking_code, category=issue.category, title=issue.title, status=issue.status,
        severity=issue.severity, lat=lat, lon=lon, created_at=issue.created_at, updated_at=issue.updated_at,
        thumbnail=media_url(first) if first else None, flag_count=issue.flag_count,
    )


def detail(db: Session, issue: Issue, viewer: User | None) -> IssueDetail:
    staff = is_staff(viewer)
    mine = viewer is not None and viewer.id == issue.reporter_id
    base = summary(db, issue)
    events = [
        EventOut(id=e.id, type=e.type, from_status=e.from_status, to_status=e.to_status, note=e.note, is_public=e.is_public,
                 actor=(e.actor.display_name if (e.actor and staff) else ("Staff" if e.actor and e.actor.role != Role.resident.value else None)),
                 created_at=e.created_at)
        for e in issue.events
        if e.is_public or staff
    ]
    out = IssueDetail(
        **base.model_dump(), description=issue.description, address_hint=issue.address_hint,
        media=[MediaOut(id=m.id, kind=m.kind, url=media_url(m), width=m.width, height=m.height) for m in issue.media],
        events=events, resolved_at=issue.resolved_at, mine=mine,
    )
    if staff:
        out.reporter = issue.reporter.display_name
        out.assigned_to = StaffOut.model_validate(issue.assigned_to) if issue.assigned_to else None
        out.duplicate_of = issue.duplicate_of_id
        out.ai = AiOut(category=issue.ai_category, confidence=issue.ai_confidence, severity=issue.ai_severity or 1, model=issue.ai_model or "", is_demo=issue.ai_is_demo, note="")
    elif mine:
        out.ai = AiOut(category=issue.ai_category, confidence=issue.ai_confidence, severity=issue.ai_severity or 1, model=issue.ai_model or "", is_demo=issue.ai_is_demo, note="")
    return out


def get_issue_or_404(db: Session, ident: str) -> Issue:
    issue = None
    try:
        issue = db.get(Issue, uuid.UUID(ident))
    except ValueError:
        issue = db.scalar(select(Issue).where(Issue.tracking_code == ident.upper()))
    if issue is None:
        raise HTTPException(status_code=404, detail="Report not found.")
    return issue
