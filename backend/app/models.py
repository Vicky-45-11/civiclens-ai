import enum
import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Role(str, enum.Enum):
    resident = "resident"
    staff = "staff"
    admin = "admin"


class Category(str, enum.Enum):
    pothole = "pothole"
    streetlight = "streetlight"
    overflowing_bin = "overflowing_bin"
    water_leak = "water_leak"
    damaged_infrastructure = "damaged_infrastructure"


class Status(str, enum.Enum):
    pending_review = "pending_review"  # awaiting human moderation, not public
    open = "open"  # approved, waiting for triage
    triaged = "triaged"
    assigned = "assigned"
    in_progress = "in_progress"
    resolved = "resolved"
    rejected = "rejected"  # moderation rejected, not public
    duplicate = "duplicate"


PUBLIC_STATUSES = (Status.open, Status.triaged, Status.assigned, Status.in_progress, Status.resolved)


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(300))
    display_name: Mapped[str] = mapped_column(String(80))
    role: Mapped[str] = mapped_column(String(16), default=Role.resident.value)
    department: Mapped[str | None] = mapped_column(String(80), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Issue(Base):
    __tablename__ = "issues"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tracking_code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    reporter_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    category: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    location = mapped_column(Geography(geometry_type="POINT", srid=4326, spatial_index=False))
    address_hint: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=Status.pending_review.value, index=True)
    severity: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)  # 1 minor .. 5 critical, set by a human
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    duplicate_of_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("issues.id"), nullable=True)
    # AI suggestions are stored next to, never instead of, the human decision.
    ai_category: Mapped[str | None] = mapped_column(String(32), nullable=True)
    ai_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_severity: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    ai_model: Mapped[str | None] = mapped_column(String(80), nullable=True)
    ai_is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
    flag_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    reporter: Mapped[User] = relationship(foreign_keys=[reporter_id])
    assigned_to: Mapped[User | None] = relationship(foreign_keys=[assigned_to_id])
    media: Mapped[list["Media"]] = relationship(back_populates="issue", order_by="Media.created_at", cascade="all, delete-orphan")
    events: Mapped[list["IssueEvent"]] = relationship(back_populates="issue", order_by="IssueEvent.created_at", cascade="all, delete-orphan")


class Media(Base):
    __tablename__ = "media"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    issue_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("issues.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(12))  # "report" or "resolution"
    object_key: Mapped[str] = mapped_column(String(200), unique=True)
    content_type: Mapped[str] = mapped_column(String(40))
    size_bytes: Mapped[int] = mapped_column(Integer)
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    phash: Mapped[str | None] = mapped_column(String(16), nullable=True)
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    issue: Mapped[Issue] = relationship(back_populates="media")


class IssueEvent(Base):
    __tablename__ = "issue_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    issue_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("issues.id", ondelete="CASCADE"), index=True)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    type: Mapped[str] = mapped_column(String(24))  # submitted, moderation, status, assignment, note, severity, duplicate, evidence, flag
    from_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    issue: Mapped[Issue] = relationship(back_populates="events")
    actor: Mapped[User | None] = relationship()


class Flag(Base):
    """A resident reporting a published issue as abusive, wrong or private."""

    __tablename__ = "flags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    issue_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("issues.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
