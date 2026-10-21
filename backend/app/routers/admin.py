import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..deps import admin_user, require_csrf_header, staff_user
from ..models import Issue, Media, Role, Status, User
from ..ratelimit import limit
from ..schemas import (
    CATEGORY_VALUES,
    IssueDetail,
    IssuePage,
    ModerateIn,
    RoleIn,
    StaffOut,
    TriageIn,
    UserOut,
)
from ..services import TRANSITIONS, add_event, detail, get_issue_or_404, summary
from ..storage import get_storage
from .issues import _load, clean_text, read_photos

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(limit("write"))])

QUEUES = {
    "moderation": [Status.pending_review.value],
    "triage": [Status.open.value, Status.triaged.value],
    "active": [Status.assigned.value, Status.in_progress.value],
    "resolved": [Status.resolved.value],
    "closed": [Status.rejected.value, Status.duplicate.value],
}


@router.get("/queue", response_model=IssuePage)
def queue(
    name: str = Query("moderation", pattern="^(moderation|triage|active|resolved|closed|all)$"),
    category: str | None = None,
    flagged: bool = False,
    mine: bool = False,
    sort: str = Query("priority", pattern="^(priority|oldest|new)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    user: User = Depends(staff_user),
    db: Session = Depends(get_db),
) -> IssuePage:
    where = []
    if name != "all":
        where.append(Issue.status.in_(QUEUES[name]))
    if category:
        if category not in CATEGORY_VALUES:
            raise HTTPException(status_code=422, detail="Unknown category.")
        where.append(Issue.category == category)
    if flagged:
        where.append(Issue.flag_count > 0)
    if mine:
        where.append(Issue.assigned_to_id == user.id)
    cond = and_(*where) if where else True
    total = db.scalar(select(func.count()).select_from(Issue).where(cond)) or 0
    if sort == "priority":  # flagged first, then human severity (or the AI suggestion), then age
        order = [Issue.flag_count.desc(), func.coalesce(Issue.severity, Issue.ai_severity, 0).desc(), Issue.created_at.asc()]
    else:
        order = [Issue.created_at.asc() if sort == "oldest" else Issue.created_at.desc()]
    rows = db.scalars(select(Issue).where(cond).order_by(*order).offset((page - 1) * page_size).limit(page_size).options(selectinload(Issue.media))).all()
    return IssuePage(items=[summary(db, i) for i in rows], total=total, page=page, page_size=page_size)


@router.get("/queue-counts")
def queue_counts(user: User = Depends(staff_user), db: Session = Depends(get_db)) -> dict[str, int]:
    rows = dict(db.execute(select(Issue.status, func.count()).group_by(Issue.status)).all())
    out = {name: sum(rows.get(s, 0) for s in statuses) for name, statuses in QUEUES.items()}
    out["flagged"] = db.scalar(select(func.count()).select_from(Issue).where(Issue.flag_count > 0)) or 0
    return out


@router.get("/staff", response_model=list[StaffOut])
def staff_list(user: User = Depends(staff_user), db: Session = Depends(get_db)) -> list[User]:
    return list(db.scalars(select(User).where(User.role.in_([Role.staff.value, Role.admin.value]), User.is_active).order_by(User.display_name)))


@router.post("/issues/{ident}/moderate", response_model=IssueDetail, dependencies=[Depends(require_csrf_header)])
def moderate(ident: str, body: ModerateIn, user: User = Depends(staff_user), db: Session = Depends(get_db)) -> IssueDetail:
    issue = get_issue_or_404(db, ident)
    if issue.status != Status.pending_review.value:
        raise HTTPException(status_code=409, detail="This report is not waiting for moderation.")
    if body.decision == "reject" and not (body.note and body.note.strip()):
        raise HTTPException(status_code=422, detail="Give a reason when rejecting a report.")
    new = Status.open.value if body.decision == "approve" else Status.rejected.value
    add_event(db, issue, "moderation", user, clean_text(body.note, 500) if body.note else None, issue.status, new, is_public=body.decision == "approve")
    issue.status = new
    db.commit()
    return detail(db, _load(db, issue.id), user)


@router.patch("/issues/{ident}", response_model=IssueDetail, dependencies=[Depends(require_csrf_header)])
def triage(ident: str, body: TriageIn, user: User = Depends(staff_user), db: Session = Depends(get_db)) -> IssueDetail:
    issue = _load(db, get_issue_or_404(db, ident).id)
    if issue.status in (Status.pending_review.value, Status.rejected.value):
        raise HTTPException(status_code=409, detail="Moderate this report first.")
    note = clean_text(body.note, 1000) if body.note else None
    changes: list[str] = []

    if body.category and body.category != issue.category:
        changes.append(f"Category changed from {issue.category} to {body.category}")
        issue.category = body.category
    if body.severity and body.severity != issue.severity:
        changes.append(f"Severity set to {body.severity}")
        issue.severity = body.severity
    if body.assigned_to_id is not None and body.assigned_to_id != issue.assigned_to_id:
        assignee = db.get(User, body.assigned_to_id)
        if not assignee or assignee.role not in (Role.staff.value, Role.admin.value) or not assignee.is_active:
            raise HTTPException(status_code=422, detail="Cases can only be assigned to active staff.")
        issue.assigned_to_id = assignee.id
        issue.assigned_to = assignee
        changes.append(f"Assigned to {assignee.display_name}")

    old = issue.status
    if body.status and body.status != old:
        if body.status not in TRANSITIONS.get(old, set()):
            raise HTTPException(status_code=409, detail=f"A {old} report cannot move to {body.status}.")
        if body.status in (Status.triaged.value, Status.assigned.value, Status.in_progress.value, Status.resolved.value) and issue.severity is None:
            raise HTTPException(status_code=422, detail="Confirm a severity (1-5) before triaging. The AI suggestion is only a suggestion.")
        if body.status == Status.assigned.value and issue.assigned_to_id is None:
            raise HTTPException(status_code=422, detail="Choose who the case is assigned to.")
        if body.status == Status.in_progress.value and issue.assigned_to_id is None:
            issue.assigned_to_id = user.id
            issue.assigned_to = user
        if body.status == Status.resolved.value:
            if not any(m.kind == "resolution" for m in issue.media):
                raise HTTPException(status_code=422, detail="Upload resolution evidence (a photo) before marking a case resolved.")
            issue.resolved_at = datetime.now(UTC)
        if body.status == Status.duplicate.value:
            if not body.duplicate_of_id or body.duplicate_of_id == issue.id or not db.get(Issue, body.duplicate_of_id):
                raise HTTPException(status_code=422, detail="Choose the original report this duplicates.")
            issue.duplicate_of_id = body.duplicate_of_id
        if old == Status.resolved.value:
            issue.resolved_at = None
        issue.status = body.status
        add_event(db, issue, "status", user, note if body.note_is_public else None, old, body.status, is_public=True)
    if changes or (note and not body.status):
        text = "; ".join(changes)
        if note:
            text = f"{text}. {note}" if text else note
        add_event(db, issue, "note" if not changes else "triage", user, text, is_public=body.note_is_public and not changes)
    elif note and body.status and not body.note_is_public:
        add_event(db, issue, "note", user, note, is_public=False)
    db.commit()
    return detail(db, _load(db, issue.id), user)


@router.post("/issues/{ident}/evidence", response_model=IssueDetail, dependencies=[Depends(require_csrf_header)])
async def add_evidence(ident: str, photos: list[UploadFile] = File(...), note: str | None = Form(None), user: User = Depends(staff_user), db: Session = Depends(get_db)) -> IssueDetail:
    issue = _load(db, get_issue_or_404(db, ident).id)
    if issue.status in (Status.pending_review.value, Status.rejected.value):
        raise HTTPException(status_code=409, detail="Moderate this report first.")
    imgs = await read_photos(photos)
    storage = get_storage()
    saved: list[str] = []
    try:
        for img in imgs:
            key = f"issues/{issue.id}/resolution-{uuid.uuid4().hex}.jpg"
            storage.put(key, img.data, "image/jpeg")
            saved.append(key)
            db.add(Media(issue_id=issue.id, kind="resolution", object_key=key, content_type="image/jpeg", size_bytes=len(img.data), width=img.width, height=img.height, phash=img.phash, uploaded_by_id=user.id))
        add_event(db, issue, "evidence", user, clean_text(note, 500) if note else "Resolution photo added.")
        db.commit()
    except Exception:
        db.rollback()
        for key in saved:
            storage.delete(key)
        raise
    return detail(db, _load(db, issue.id), user)


@router.get("/users", response_model=list[UserOut])
def users(user: User = Depends(admin_user), db: Session = Depends(get_db)) -> list[User]:
    return list(db.scalars(select(User).order_by(User.created_at.desc()).limit(200)))


@router.patch("/users/{user_id}/role", response_model=UserOut, dependencies=[Depends(require_csrf_header)])
def set_role(user_id: uuid.UUID, body: RoleIn, admin: User = Depends(admin_user), db: Session = Depends(get_db)) -> User:
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if target.id == admin.id and body.role != Role.admin.value:
        raise HTTPException(status_code=409, detail="You cannot remove your own admin role.")
    target.role = body.role
    target.department = body.department
    db.commit()
    return target
