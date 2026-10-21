import math
import re
import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
)
from geoalchemy2 import Geometry
from sqlalchemy import String, and_, cast, func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..ai import duplicates as dup
from ..ai.classifier import get_classifier
from ..ai.imaging import InvalidImage, ProcessedImage, process_upload
from ..config import get_settings
from ..db import get_db
from ..deps import current_user, optional_user, require_csrf_header
from ..models import Category, Flag, Issue, Media, Status, User
from ..ratelimit import limit
from ..schemas import (
    AiOut,
    Cluster,
    CreatedOut,
    DuplicateOut,
    FlagIn,
    IssueDetail,
    IssuePage,
    PreviewOut,
)
from ..security import new_tracking_code
from ..services import (
    PUBLIC_VALUES,
    add_event,
    can_view,
    detail,
    get_issue_or_404,
    summary,
)
from ..storage import get_storage

router = APIRouter(tags=["issues"])

CATEGORIES = {c.value for c in Category}
CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def clean_text(v: str, max_len: int) -> str:
    return CONTROL.sub("", v).strip()[:max_len]


def check_point(lat: float, lon: float) -> None:
    if not (math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180):
        raise HTTPException(status_code=422, detail="Location is out of range.")


async def read_photos(files: list[UploadFile]) -> list[ProcessedImage]:
    s = get_settings()
    if not files:
        raise HTTPException(status_code=422, detail="Add at least one photo.")
    if len(files) > s.max_photos_per_issue:
        raise HTTPException(status_code=422, detail=f"At most {s.max_photos_per_issue} photos per report.")
    out: list[ProcessedImage] = []
    for f in files:
        raw = await f.read(s.max_upload_bytes + 1)
        if len(raw) > s.max_upload_bytes:
            raise HTTPException(status_code=413, detail="A photo is larger than the allowed size.")
        try:
            out.append(process_upload(raw))
        except InvalidImage as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    return out


def dup_out(c: dup.Candidate) -> DuplicateOut:
    i = c.issue
    return DuplicateOut(id=i.id, tracking_code=i.tracking_code, title=i.title, category=i.category, status=i.status, distance_m=round(c.distance_m, 1), photo_distance=c.photo_distance, likely=c.likely)


def ai_out(sug) -> AiOut:
    return AiOut(category=sug.category, confidence=sug.confidence, severity=sug.severity, model=sug.model, is_demo=sug.is_demo, note=sug.note)


@router.post("/issues/preview", response_model=PreviewOut, dependencies=[Depends(limit("submit")), Depends(require_csrf_header)])
async def preview(photos: list[UploadFile] = File(...), lat: float = Form(...), lon: float = Form(...), category: str | None = Form(None), user: User = Depends(current_user), db: Session = Depends(get_db)) -> PreviewOut:
    """Shows the AI suggestion and possible duplicates before anything is saved."""
    check_point(lat, lon)
    if category and category not in CATEGORIES:
        raise HTTPException(status_code=422, detail="Unknown category.")
    imgs = await read_photos(photos)
    sug = get_classifier().suggest(imgs[0].image, category)
    cat = sug.category or category
    cands = dup.find_candidates(db, lat, lon, cat, imgs[0].phash) if cat else []
    return PreviewOut(ai=ai_out(sug), duplicates=[dup_out(c) for c in cands])


@router.post("/issues", response_model=CreatedOut, status_code=201, dependencies=[Depends(limit("submit")), Depends(require_csrf_header)])
async def create_issue(
    photos: list[UploadFile] = File(...),
    category: str = Form(...),
    title: str = Form(...),
    description: str = Form(""),
    lat: float = Form(...),
    lon: float = Form(...),
    address_hint: str | None = Form(None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> CreatedOut:
    check_point(lat, lon)
    if category not in CATEGORIES:
        raise HTTPException(status_code=422, detail="Unknown category.")
    title, description = clean_text(title, 120), clean_text(description, 2000)
    if len(title) < 3:
        raise HTTPException(status_code=422, detail="Add a short title (at least 3 characters).")
    imgs = await read_photos(photos)
    sug = get_classifier().suggest(imgs[0].image, category)

    issue = Issue(
        tracking_code=_unique_code(db), reporter_id=user.id, category=category, title=title, description=description,
        location=func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326), address_hint=clean_text(address_hint, 200) if address_hint else None,
        status=Status.pending_review.value, ai_category=sug.category, ai_confidence=sug.confidence, ai_severity=sug.severity, ai_model=sug.model, ai_is_demo=sug.is_demo,
    )
    db.add(issue)
    db.flush()
    storage = get_storage()
    saved: list[str] = []
    try:
        for img in imgs:
            key = f"issues/{issue.id}/{uuid.uuid4().hex}.jpg"
            storage.put(key, img.data, "image/jpeg")
            saved.append(key)
            db.add(Media(issue_id=issue.id, kind="report", object_key=key, content_type="image/jpeg", size_bytes=len(img.data), width=img.width, height=img.height, phash=img.phash, uploaded_by_id=user.id))
        add_event(db, issue, "submitted", user, "Report received. A person will review it before it is published.", to_status=Status.pending_review.value)
        cands = dup.find_candidates(db, lat, lon, category, imgs[0].phash, exclude_id=issue.id)
        if any(c.likely for c in cands):
            add_event(db, issue, "duplicate", None, "Possible duplicate of " + ", ".join(c.issue.tracking_code for c in cands if c.likely), is_public=False)
        db.commit()
    except Exception:
        db.rollback()
        for key in saved:
            storage.delete(key)
        raise
    db.refresh(issue)
    return CreatedOut(issue=detail(db, _load(db, issue.id), user), duplicates=[dup_out(c) for c in cands])


def _unique_code(db: Session) -> str:
    for _ in range(8):
        code = new_tracking_code()
        if not db.scalar(select(Issue.id).where(Issue.tracking_code == code)):
            return code
    raise HTTPException(status_code=503, detail="Could not allocate a tracking code, try again.")


def _load(db: Session, issue_id) -> Issue:
    return db.scalars(select(Issue).where(Issue.id == issue_id).options(selectinload(Issue.media), selectinload(Issue.events), selectinload(Issue.reporter), selectinload(Issue.assigned_to)).execution_options(populate_existing=True)).one()


@router.get("/issues", response_model=IssuePage, dependencies=[Depends(limit("read"))])
def list_issues(
    status: str | None = None,
    category: str | None = None,
    q: str | None = Query(None, max_length=80),
    bbox: str | None = Query(None, description="minLon,minLat,maxLon,maxLat"),
    mine: bool = False,
    sort: str = Query("new", pattern="^(new|updated)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User | None = Depends(optional_user),
    db: Session = Depends(get_db),
) -> IssuePage:
    if mine:
        if user is None:
            raise HTTPException(status_code=401, detail="Please sign in.")
        cond = Issue.reporter_id == user.id
    else:
        cond = Issue.status.in_(PUBLIC_VALUES)
    where = [cond]
    if status:
        if status not in {s.value for s in Status}:
            raise HTTPException(status_code=422, detail="Unknown status.")
        where.append(Issue.status == status)
    if category:
        if category not in CATEGORIES:
            raise HTTPException(status_code=422, detail="Unknown category.")
        where.append(Issue.category == category)
    if q:
        like = f"%{q.replace('%', '').replace('_', '')}%"
        where.append(or_(Issue.title.ilike(like), Issue.description.ilike(like), Issue.tracking_code.ilike(like)))
    if bbox:
        where.append(_bbox(bbox))
    total = db.scalar(select(func.count()).select_from(Issue).where(and_(*where))) or 0
    order = Issue.updated_at.desc() if sort == "updated" else Issue.created_at.desc()
    rows = db.scalars(select(Issue).where(and_(*where)).order_by(order).offset((page - 1) * page_size).limit(page_size).options(selectinload(Issue.media))).all()
    return IssuePage(items=[summary(db, i) for i in rows], total=total, page=page, page_size=page_size)


def _bbox(bbox: str):
    try:
        x1, y1, x2, y2 = (float(p) for p in bbox.split(","))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="bbox must be minLon,minLat,maxLon,maxLat.") from exc
    if not all(math.isfinite(v) for v in (x1, y1, x2, y2)) or x1 >= x2 or y1 >= y2:
        raise HTTPException(status_code=422, detail="bbox is invalid.")
    return func.ST_Intersects(cast(Issue.location, Geometry), func.ST_MakeEnvelope(x1, y1, x2, y2, 4326))


@router.get("/issues/clusters", response_model=list[Cluster], dependencies=[Depends(limit("read"))])
def clusters(bbox: str, zoom: int = Query(..., ge=0, le=20), category: str | None = None, status: str | None = None, db: Session = Depends(get_db)) -> list[Cluster]:
    """Grid clustering done in PostGIS: points are snapped to a grid whose cell size shrinks as the map zooms in."""
    cell = 360.0 / (2 ** (zoom + 2))  # about 90px per cell on a 256px tile map
    geom = cast(Issue.location, Geometry)
    where = [Issue.status.in_(PUBLIC_VALUES), _bbox(bbox)]
    if category:
        if category not in CATEGORIES:
            raise HTTPException(status_code=422, detail="Unknown category.")
        where.append(Issue.category == category)
    if status:
        where.append(Issue.status == status)
    snapped = func.ST_SnapToGrid(geom, cell, cell)
    q = (
        select(
            func.ST_Y(func.ST_Centroid(func.ST_Collect(geom))), func.ST_X(func.ST_Centroid(func.ST_Collect(geom))),
            func.count(), func.min(cast(Issue.id, String)), func.min(Issue.category), func.max(Issue.severity),
        )
        .where(and_(*where))
        .group_by(snapped)
        .limit(500)
    )
    out = []
    for lat, lon, n, one_id, cat, sev in db.execute(q).all():
        out.append(Cluster(lat=float(lat), lon=float(lon), count=int(n), issue_id=uuid.UUID(one_id) if n == 1 else None, category=cat if n == 1 else None, max_severity=sev))
    return out


@router.get("/issues/{ident}", response_model=IssueDetail, dependencies=[Depends(limit("read"))])
def get_issue(ident: str, user: User | None = Depends(optional_user), db: Session = Depends(get_db)) -> IssueDetail:
    issue = get_issue_or_404(db, ident)
    if not can_view(issue, user):
        raise HTTPException(status_code=404, detail="Report not found.")  # same answer as a missing one, so private reports are not revealed
    return detail(db, _load(db, issue.id), user)


@router.get("/media/{media_id}", dependencies=[Depends(limit("read"))])
def get_media(media_id: uuid.UUID, user: User | None = Depends(optional_user), db: Session = Depends(get_db)) -> Response:
    m = db.get(Media, media_id)
    issue = m.issue if m else None
    if not m or not issue or not can_view(issue, user):
        raise HTTPException(status_code=404, detail="Not found.")
    private = issue.status not in PUBLIC_VALUES
    return Response(get_storage().get(m.object_key), media_type="image/jpeg", headers={"Cache-Control": "private, max-age=300" if private else "public, max-age=3600", "X-Content-Type-Options": "nosniff"})


@router.post("/issues/{ident}/flag", status_code=204, dependencies=[Depends(limit("write")), Depends(require_csrf_header)])
def flag_issue(ident: str, body: FlagIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> None:
    issue = get_issue_or_404(db, ident)
    if issue.status not in PUBLIC_VALUES:
        raise HTTPException(status_code=404, detail="Report not found.")
    if db.scalar(select(Flag.id).where(Flag.issue_id == issue.id, Flag.user_id == user.id)):
        raise HTTPException(status_code=409, detail="You already flagged this report.")
    db.add(Flag(issue_id=issue.id, user_id=user.id, reason=clean_text(body.reason, 300)))
    issue.flag_count += 1
    add_event(db, issue, "flag", user, clean_text(body.reason, 300), is_public=False)
    db.commit()
