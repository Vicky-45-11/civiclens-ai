"""Initial schema: users, issues (PostGIS geography), media, events, flags.

Revision ID: 0001
Revises:
"""

import geoalchemy2
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0001"
down_revision = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("password_hash", sa.String(300), nullable=False),
        sa.Column("display_name", sa.String(80), nullable=False),
        sa.Column("role", sa.String(16), nullable=False, server_default="resident"),
        sa.Column("department", sa.String(80)),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("role in ('resident','staff','admin')", name="ck_users_role"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "issues",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tracking_code", sa.String(16), nullable=False),
        sa.Column("reporter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("category", sa.String(32), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
        sa.Column("location", geoalchemy2.Geography(geometry_type="POINT", srid=4326, spatial_index=False), nullable=False),
        sa.Column("address_hint", sa.String(200)),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending_review"),
        sa.Column("severity", sa.SmallInteger),
        sa.Column("assigned_to_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("duplicate_of_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("issues.id")),
        sa.Column("ai_category", sa.String(32)),
        sa.Column("ai_confidence", sa.Float),
        sa.Column("ai_severity", sa.SmallInteger),
        sa.Column("ai_model", sa.String(80)),
        sa.Column("ai_is_demo", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("flag_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("category in ('pothole','streetlight','overflowing_bin','water_leak','damaged_infrastructure')", name="ck_issues_category"),
        sa.CheckConstraint("status in ('pending_review','open','triaged','assigned','in_progress','resolved','rejected','duplicate')", name="ck_issues_status"),
        sa.CheckConstraint("severity is null or severity between 1 and 5", name="ck_issues_severity"),
    )
    op.create_index("ix_issues_tracking_code", "issues", ["tracking_code"], unique=True)
    op.create_index("ix_issues_reporter_id", "issues", ["reporter_id"])
    op.create_index("ix_issues_category", "issues", ["category"])
    op.create_index("ix_issues_status", "issues", ["status"])
    op.create_index("ix_issues_assigned_to_id", "issues", ["assigned_to_id"])
    op.create_index("ix_issues_created_at", "issues", ["created_at"])
    op.create_index("idx_issues_location", "issues", ["location"], postgresql_using="gist")

    op.create_table(
        "media",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("issue_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("issues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(12), nullable=False),
        sa.Column("object_key", sa.String(200), nullable=False, unique=True),
        sa.Column("content_type", sa.String(40), nullable=False),
        sa.Column("size_bytes", sa.Integer, nullable=False),
        sa.Column("width", sa.Integer, nullable=False),
        sa.Column("height", sa.Integer, nullable=False),
        sa.Column("phash", sa.String(16)),
        sa.Column("uploaded_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("kind in ('report','resolution')", name="ck_media_kind"),
    )
    op.create_index("ix_media_issue_id", "media", ["issue_id"])

    op.create_table(
        "issue_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("issue_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("issues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("type", sa.String(24), nullable=False),
        sa.Column("from_status", sa.String(20)),
        sa.Column("to_status", sa.String(20)),
        sa.Column("note", sa.Text),
        sa.Column("is_public", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_issue_events_issue_id", "issue_events", ["issue_id"])

    op.create_table(
        "flags",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("issue_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("issues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reason", sa.String(300), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("issue_id", "user_id", name="uq_flags_issue_user"),
    )
    op.create_index("ix_flags_issue_id", "flags", ["issue_id"])


def downgrade() -> None:
    for t in ("flags", "issue_events", "media", "issues", "users"):
        op.drop_table(t)
