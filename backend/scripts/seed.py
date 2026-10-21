"""Load SAMPLE data so the app has something to show in development.

Everything created here is fictional: placeholder pictures, invented reports, and example accounts.
It refuses to run when APP_ENV is not "development" unless --force is given.

    python -m scripts.seed            # add sample data (idempotent for accounts)
    python -m scripts.seed --reset    # delete all reports first
"""

import argparse
import io
import random
import sys
import uuid
from datetime import UTC, datetime, timedelta

from PIL import Image, ImageDraw
from sqlalchemy import delete, func, select

from app.ai.classifier import get_classifier
from app.ai.imaging import process_upload
from app.config import get_settings
from app.db import get_db
from app.models import Category, Flag, Issue, IssueEvent, Media, Role, User
from app.security import hash_password, new_tracking_code
from app.storage import get_storage

CENTER = (12.9716, 80.0440)  # an arbitrary map centre; reports are scattered around it
SAMPLE_PASSWORD = "sample-password-123"
ACCOUNTS = [
    ("admin@civiclens.example", "Sample Admin", Role.admin, "Operations"),
    ("staff@civiclens.example", "Sample Crew Lead", Role.staff, "Roads"),
    ("staff2@civiclens.example", "Sample Technician", Role.staff, "Lighting"),
    ("resident@civiclens.example", "Sample Resident", Role.resident, None),
]
TITLES = {
    "pothole": ["Deep pothole on the main road", "Cracked asphalt near the bus stop", "Pothole filled with water"],
    "streetlight": ["Streetlight out on the corner", "Flickering lamp by the park gate", "Dark stretch, two lamps dead"],
    "overflowing_bin": ["Bin overflowing onto the footpath", "Rubbish pile beside the market", "Public bin not emptied"],
    "water_leak": ["Water leaking from a pipe", "Burst main flooding the lane", "Constant drip from a valve"],
    "damaged_infrastructure": ["Broken pavement slab", "Bent guardrail by the bridge", "Collapsed drain cover"],
}
COLORS = {"pothole": (70, 70, 74), "streetlight": (30, 36, 60), "overflowing_bin": (80, 96, 70), "water_leak": (50, 90, 120), "damaged_infrastructure": (110, 92, 80)}


def placeholder(category: str, label: str, seed: int) -> bytes:
    rnd = random.Random(seed)
    base = COLORS[category]
    img = Image.new("RGB", (640, 480), base)
    d = ImageDraw.Draw(img)
    for _ in range(40):
        x, y, r = rnd.randint(0, 640), rnd.randint(0, 480), rnd.randint(10, 90)
        shade = rnd.randint(-25, 25)
        d.ellipse((x - r, y - r, x + r, y + r), fill=tuple(max(0, min(255, c + shade)) for c in base))
    d.rectangle((0, 440, 640, 480), fill=(0, 0, 0))
    d.text((12, 452), f"SAMPLE IMAGE (not a real report) - {label}", fill=(255, 255, 255))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=80)
    return out.getvalue()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--count", type=int, default=36)
    args = ap.parse_args()
    s = get_settings()
    if s.app_env != "development" and not args.force:
        sys.exit("Refusing to load sample data outside APP_ENV=development (use --force if you really mean it).")

    db = next(get_db())
    storage = get_storage()
    if args.reset:
        for m in db.scalars(select(Media)):
            storage.delete(m.object_key)
        db.execute(delete(Flag))
        db.execute(delete(Issue))
        db.commit()

    users: dict[str, User] = {}
    for email, name, role, dept in ACCOUNTS:
        u = db.scalar(select(User).where(User.email == email))
        if not u:
            u = User(email=email, password_hash=hash_password(SAMPLE_PASSWORD), display_name=name, role=role.value, department=dept)
            db.add(u)
        users[email] = u
    db.commit()
    resident, staff, staff2, admin = users["resident@civiclens.example"], users["staff@civiclens.example"], users["staff2@civiclens.example"], users["admin@civiclens.example"]

    if db.scalar(select(func.count()).select_from(Issue)):
        print("Reports already exist; skipping (use --reset to start over).")
        return

    rnd = random.Random(7)
    clf = get_classifier()
    cats = list(Category)
    plan = ["pending_review"] * 4 + ["open"] * 8 + ["triaged"] * 5 + ["assigned"] * 5 + ["in_progress"] * 5 + ["resolved"] * 8 + ["rejected"] * 1
    hot = (CENTER[0] + 0.004, CENTER[1] - 0.003)  # a deliberate cluster of reports so the map shows grouping
    for i in range(args.count):
        status = plan[i % len(plan)]
        cat = cats[i % len(cats)].value
        near = i % 3 == 0
        lat = (hot[0] + rnd.uniform(-0.0006, 0.0006)) if near else CENTER[0] + rnd.uniform(-0.02, 0.02)
        lon = (hot[1] + rnd.uniform(-0.0006, 0.0006)) if near else CENTER[1] + rnd.uniform(-0.02, 0.02)
        created = datetime.now(UTC) - timedelta(days=rnd.randint(1, 28), hours=rnd.randint(0, 20))
        img = process_upload(placeholder(cat, f"#{i + 1}", i))
        sug = clf.suggest(img.image, cat)
        sev = rnd.randint(1, 5) if status not in ("pending_review", "open", "rejected") else None
        issue = Issue(
            tracking_code=new_tracking_code(), reporter_id=resident.id, category=cat, title=rnd.choice(TITLES[cat]), description="Sample report created by the seed script.",
            location=func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326), status=status, severity=sev, created_at=created, updated_at=created,
            ai_category=sug.category, ai_confidence=sug.confidence, ai_severity=sug.severity, ai_model=sug.model, ai_is_demo=sug.is_demo,
            assigned_to_id=(staff if i % 2 else staff2).id if status in ("assigned", "in_progress", "resolved") else None,
        )
        db.add(issue)
        db.flush()
        key = f"issues/{issue.id}/{uuid.uuid4().hex}.jpg"
        storage.put(key, img.data, "image/jpeg")
        db.add(Media(issue_id=issue.id, kind="report", object_key=key, content_type="image/jpeg", size_bytes=len(img.data), width=img.width, height=img.height, phash=img.phash, uploaded_by_id=resident.id))
        db.add(IssueEvent(issue_id=issue.id, actor_id=resident.id, type="submitted", note="Report received.", to_status="pending_review", created_at=created))
        if status != "pending_review":
            db.add(IssueEvent(issue_id=issue.id, actor_id=staff.id, type="moderation", from_status="pending_review", to_status="open" if status != "rejected" else "rejected", note="Rejected: sample duplicate photo." if status == "rejected" else None, is_public=status != "rejected", created_at=created + timedelta(hours=2)))
        if status == "resolved":
            rimg = process_upload(placeholder(cat, f"fixed #{i + 1}", 1000 + i))
            rkey = f"issues/{issue.id}/resolution-{uuid.uuid4().hex}.jpg"
            storage.put(rkey, rimg.data, "image/jpeg")
            db.add(Media(issue_id=issue.id, kind="resolution", object_key=rkey, content_type="image/jpeg", size_bytes=len(rimg.data), width=rimg.width, height=rimg.height, phash=rimg.phash, uploaded_by_id=staff.id))
            issue.resolved_at = created + timedelta(days=rnd.randint(2, 9))
            db.add(IssueEvent(issue_id=issue.id, actor_id=staff.id, type="status", from_status="in_progress", to_status="resolved", note=None, created_at=issue.resolved_at))
    db.commit()
    print(f"Created {args.count} sample reports and {len(ACCOUNTS)} sample accounts.")
    print(f"Sample sign-ins (password {SAMPLE_PASSWORD!r}): " + ", ".join(a[0] for a in ACCOUNTS))
    _ = admin


if __name__ == "__main__":
    main()
