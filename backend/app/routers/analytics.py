from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from geoalchemy2 import Geometry
from sqlalchemy import case, cast, func, literal_column, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import staff_user
from ..models import Issue, Status, User
from ..ratelimit import limit
from ..services import PUBLIC_VALUES

router = APIRouter(tags=["analytics"])


def _median_days(db: Session, *where) -> float | None:
    secs = func.extract("epoch", Issue.resolved_at - Issue.created_at)
    v = db.scalar(select(func.percentile_cont(0.5).within_group(secs)).where(Issue.resolved_at.is_not(None), *where))
    return round(float(v) / 86400, 2) if v is not None else None


@router.get("/stats", dependencies=[Depends(limit("read"))])
def public_stats(db: Session = Depends(get_db)) -> dict:
    """Counts of published reports, computed from the database on each request."""
    by_status = dict(db.execute(select(Issue.status, func.count()).where(Issue.status.in_(PUBLIC_VALUES)).group_by(Issue.status)).all())
    by_cat = dict(db.execute(select(Issue.category, func.count()).where(Issue.status.in_(PUBLIC_VALUES)).group_by(Issue.category)).all())
    return {
        "total": sum(by_status.values()),
        "resolved": by_status.get(Status.resolved.value, 0),
        "by_status": by_status,
        "by_category": by_cat,
        "median_days_to_resolve": _median_days(db, Issue.status == Status.resolved.value),
    }


@router.get("/admin/analytics", dependencies=[Depends(limit("read"))])
def analytics(user: User = Depends(staff_user), db: Session = Depends(get_db)) -> dict:
    now = datetime.now(UTC)
    since = now - timedelta(days=30)
    day = func.date_trunc("day", Issue.created_at)
    daily = [{"date": d.date().isoformat(), "count": n} for d, n in db.execute(select(day, func.count()).where(Issue.created_at >= since).group_by(day).order_by(day)).all()]
    open_states = [Status.open.value, Status.triaged.value, Status.assigned.value, Status.in_progress.value]
    sev_expr = func.coalesce(Issue.severity, literal_column("0"))
    sev = dict(db.execute(select(sev_expr, func.count()).where(Issue.status.in_(open_states)).group_by(sev_expr)).all())
    by_cat = [
        {"category": c, "total": t, "open": o, "median_days_to_resolve": _median_days(db, Issue.category == c, Issue.status == Status.resolved.value)}
        for c, t, o in db.execute(select(Issue.category, func.count(), func.sum(case((Issue.status.in_(open_states), 1), else_=0))).group_by(Issue.category).order_by(Issue.category)).all()
    ]
    status = dict(db.execute(select(Issue.status, func.count()).group_by(Issue.status)).all())
    # How often the AI category matched the category a person ended up with (only where a model made a real prediction).
    judged = db.execute(select(func.count(), func.sum(case((Issue.ai_category == Issue.category, 1), else_=0))).where(Issue.ai_is_demo.is_(False), Issue.ai_category.is_not(None), Issue.status.not_in([Status.pending_review.value]))).one()
    geom = cast(Issue.location, Geometry)
    cell = 0.005  # about 500 m
    cx, cy = func.ST_X(func.ST_Centroid(func.ST_Collect(geom))), func.ST_Y(func.ST_Centroid(func.ST_Collect(geom)))
    hotspots = [
        {"lat": float(y), "lon": float(x), "count": n}
        for x, y, n in db.execute(select(cx, cy, func.count()).where(Issue.status.in_(open_states)).group_by(func.ST_SnapToGrid(geom, cell, cell)).order_by(func.count().desc()).limit(5)).all()
    ]
    oldest = db.scalar(select(func.min(Issue.created_at)).where(Issue.status.in_(open_states)))
    return {
        "generated_at": now.isoformat(),
        "by_status": status,
        "daily_last_30_days": daily,
        "open_by_severity": {str(k): v for k, v in sorted(sev.items())},
        "by_category": by_cat,
        "median_days_to_resolve": _median_days(db),
        "oldest_open_days": round((now - oldest).total_seconds() / 86400, 1) if oldest else None,
        "flagged": db.scalar(select(func.count()).select_from(Issue).where(Issue.flag_count > 0)) or 0,
        "ai_agreement": {"judged": int(judged[0] or 0), "matched": int(judged[1] or 0)},
        "hotspots": hotspots,
    }
