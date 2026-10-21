import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .models import Category

CategoryName = Literal["pothole", "streetlight", "overflowing_bin", "water_leak", "damaged_infrastructure"]
StatusName = Literal["pending_review", "open", "triaged", "assigned", "in_progress", "resolved", "rejected", "duplicate"]


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    display_name: str = Field(min_length=1, max_length=80)

    @field_validator("display_name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = " ".join(v.split())
        if not v:
            raise ValueError("display name is required")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    display_name: str
    role: str
    department: str | None = None


class StaffOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    display_name: str
    department: str | None = None


class MediaOut(BaseModel):
    id: uuid.UUID
    kind: str
    url: str
    width: int
    height: int


class EventOut(BaseModel):
    id: uuid.UUID
    type: str
    from_status: str | None
    to_status: str | None
    note: str | None
    is_public: bool
    actor: str | None  # "Staff" for public viewers, a name for staff
    created_at: datetime


class DuplicateOut(BaseModel):
    id: uuid.UUID
    tracking_code: str
    title: str
    category: str
    status: str
    distance_m: float
    photo_distance: int | None
    likely: bool


class AiOut(BaseModel):
    category: str | None
    confidence: float | None
    severity: int
    model: str
    is_demo: bool
    note: str


class IssueSummary(BaseModel):
    id: uuid.UUID
    tracking_code: str
    category: str
    title: str
    status: str
    severity: int | None
    lat: float
    lon: float
    created_at: datetime
    updated_at: datetime
    thumbnail: str | None
    flag_count: int = 0


class IssueDetail(IssueSummary):
    description: str
    address_hint: str | None
    media: list[MediaOut]
    events: list[EventOut]
    resolved_at: datetime | None
    mine: bool = False
    # Present only for staff:
    reporter: str | None = None
    assigned_to: StaffOut | None = None
    duplicate_of: uuid.UUID | None = None
    ai: AiOut | None = None


class IssuePage(BaseModel):
    items: list[IssueSummary]
    total: int
    page: int
    page_size: int


class PreviewOut(BaseModel):
    ai: AiOut
    duplicates: list[DuplicateOut]


class CreatedOut(BaseModel):
    issue: IssueDetail
    duplicates: list[DuplicateOut]


class Cluster(BaseModel):
    lat: float
    lon: float
    count: int
    issue_id: uuid.UUID | None  # set when the cluster holds exactly one issue
    category: str | None
    max_severity: int | None


class FlagIn(BaseModel):
    reason: str = Field(min_length=3, max_length=300)


class ModerateIn(BaseModel):
    decision: Literal["approve", "reject"]
    note: str | None = Field(default=None, max_length=500)


class TriageIn(BaseModel):
    category: CategoryName | None = None
    severity: int | None = Field(default=None, ge=1, le=5)
    status: StatusName | None = None
    assigned_to_id: uuid.UUID | None = None
    duplicate_of_id: uuid.UUID | None = None
    note: str | None = Field(default=None, max_length=1000)
    note_is_public: bool = False


class RoleIn(BaseModel):
    role: Literal["resident", "staff", "admin"]
    department: str | None = Field(default=None, max_length=80)


CATEGORY_VALUES = [c.value for c in Category]
