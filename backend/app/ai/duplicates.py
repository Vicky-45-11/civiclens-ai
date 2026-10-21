"""Duplicate detection: nearby reports of the same kind, ranked by place and photo similarity."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Issue, Media, Status
from .imaging import hamming

ACTIVE = (Status.pending_review, Status.open, Status.triaged, Status.assigned, Status.in_progress)


@dataclass
class Candidate:
    issue: Issue
    distance_m: float
    photo_distance: int | None
    likely: bool


def find_candidates(db: Session, lat: float, lon: float, category: str, phash: str | None, exclude_id=None, limit: int = 5) -> list[Candidate]:
    s = get_settings()
    point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326).cast(Issue.location.type)
    dist = func.ST_Distance(Issue.location, point)
    since = datetime.now(UTC) - timedelta(days=120)
    q = (
        select(Issue, dist)
        .where(func.ST_DWithin(Issue.location, point, s.duplicate_radius_m))
        .where(Issue.category == category)
        .where(Issue.status.in_([st.value for st in ACTIVE]))
        .where(Issue.created_at >= since)
        .order_by(dist)
        .limit(limit)
    )
    if exclude_id is not None:
        q = q.where(Issue.id != exclude_id)
    out: list[Candidate] = []
    for issue, d in db.execute(q).all():
        best: int | None = None
        for m in db.scalars(select(Media).where(Media.issue_id == issue.id, Media.kind == "report")):
            h = hamming(phash, m.phash)
            if h is not None and (best is None or h < best):
                best = h
        likely = (best is not None and best <= s.duplicate_phash_distance) or float(d) <= s.duplicate_radius_m / 3
        out.append(Candidate(issue, float(d), best, likely))
    return out
