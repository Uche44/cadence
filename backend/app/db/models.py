"""The domain model.

Every table earns its place by serving something the user can see or the product
must remember. The docstring on each one names that reason, so a future reader can
tell whether it is still needed.

Times are stored as **minutes since midnight** rather than SQLite time strings.
The scheduler and the validator already work in whole minutes, so storing
anything else would invite rounding drift at the boundary. Dates are stored as
dates, and timestamps as UTC (see ``UtcTimestamp``).
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from enum import StrEnum
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.base import Base, StringList, UtcTimestamp
from app.safety.models import Intensity

MINUTES_PER_DAY = 24 * 60


def new_id() -> str:
    return uuid4().hex


def utcnow() -> datetime:
    return datetime.now(UTC)


class Energy(StrEnum):
    LOW = "low"
    STEADY = "steady"
    HIGH = "high"


class PlanStatus(StrEnum):
    PLANNED = "planned"
    STOPPED = "stopped"
    COMPLETED = "completed"


class BlockStatus(StrEnum):
    PLANNED = "planned"
    DONE = "done"
    SKIPPED = "skipped"


class CompletionOutcome(StrEnum):
    DONE = "done"
    SKIPPED = "skipped"


class FeltRating(StrEnum):
    TOO_DRAINING = "too_draining"
    JUST_RIGHT = "just_right"
    HAD_ENERGY = "had_energy"


class User(Base):
    """The person being planned for. Sign up and log in (M7)."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    # NOCASE gives case-insensitive uniqueness in the database itself, so "A@b.com"
    # and "a@b.com" cannot both exist even if a caller forgets to normalise.
    email: Mapped[str] = mapped_column(String(320, collation="NOCASE"), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)

    created_at: Mapped[datetime] = mapped_column(UtcTimestamp, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UtcTimestamp, default=utcnow, onupdate=utcnow)

    profile: Mapped[Profile | None] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    consents: Mapped[list[Consent]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    auth_sessions: Mapped[list[AuthSession]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    checkins: Mapped[list[Checkin]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    symptom_notes: Mapped[list[SymptomNote]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )

    @validates("email")
    def _normalise_email(self, _key: str, value: str) -> str:
        return value.strip().lower()


class Profile(Base):
    """Everything onboarding collects: conditions, enjoyment, routine, clearance.

    One row per user. Screens 4-6 and the profile screen (M8, M15).
    """

    __tablename__ = "profiles"
    __table_args__ = (
        CheckConstraint("wake_minute >= 0 AND wake_minute < 1440", name="ck_profile_wake"),
        CheckConstraint("bed_minute > 0 AND bed_minute < 1440", name="ck_profile_bed"),
        CheckConstraint("bed_minute > wake_minute", name="ck_profile_bed_after_wake"),
        CheckConstraint("onboarding_step >= 0 AND onboarding_step <= 4", name="ck_profile_step"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )

    conditions: Mapped[list[str]] = mapped_column(StringList, default=list)
    interests: Mapped[list[str]] = mapped_column(StringList, default=list)
    equipment: Mapped[list[str]] = mapped_column(StringList, default=list)

    wake_minute: Mapped[int] = mapped_column(Integer, default=390)  # 06:30
    bed_minute: Mapped[int] = mapped_column(Integer, default=1335)  # 22:15
    doctor_clearance: Mapped[bool] = mapped_column(Boolean, default=False)

    emergency_contact_name: Mapped[str | None] = mapped_column(String(120))
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(40))
    emergency_contact_relationship: Mapped[str | None] = mapped_column(String(60))

    onboarding_step: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(UtcTimestamp, default=utcnow, onupdate=utcnow)

    user: Mapped[User] = relationship(back_populates="profile")


class Consent(Base):
    """The safety notice the user accepted, and which version. Screen 7."""

    __tablename__ = "consents"
    __table_args__ = (UniqueConstraint("user_id", "version", name="uq_consent_version"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    version: Mapped[str] = mapped_column(String(40), nullable=False)
    accepted_at: Mapped[datetime] = mapped_column(UtcTimestamp, default=utcnow)

    user: Mapped[User] = relationship(back_populates="consents")


class AuthSession(Base):
    """A signed-in browser session. Only a hash of the token is stored."""

    __tablename__ = "auth_sessions"
    __table_args__ = (CheckConstraint("expires_at > created_at", name="ck_session_window"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(UtcTimestamp, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(UtcTimestamp, nullable=False)

    user: Mapped[User] = relationship(back_populates="auth_sessions")


class Checkin(Base):
    """One morning check-in per local day. Screen 9."""

    __tablename__ = "checkins"
    __table_args__ = (UniqueConstraint("user_id", "local_date", name="uq_checkin_day"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    local_date: Mapped[date] = mapped_column(Date, nullable=False)
    energy: Mapped[Energy] = mapped_column(
        Enum(Energy, native_enum=False, create_constraint=True, length=16),
        nullable=False,
    )
    symptoms: Mapped[list[str]] = mapped_column(StringList, default=list)
    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(UtcTimestamp, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UtcTimestamp, default=utcnow, onupdate=utcnow)

    user: Mapped[User] = relationship(back_populates="checkins")
    commitments: Mapped[list[Commitment]] = relationship(
        back_populates="checkin", cascade="all, delete-orphan", passive_deletes=True
    )
    plan: Mapped[Plan | None] = relationship(
        back_populates="checkin", cascade="all, delete-orphan", passive_deletes=True
    )


class Commitment(Base):
    """A fixed part of the day entered during check-in. Screen 9."""

    __tablename__ = "commitments"
    __table_args__ = (
        CheckConstraint("start_minute >= 0", name="ck_commitment_start"),
        CheckConstraint("end_minute <= 1440", name="ck_commitment_end"),
        CheckConstraint("end_minute > start_minute", name="ck_commitment_order"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    checkin_id: Mapped[str] = mapped_column(
        ForeignKey("checkins.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    start_minute: Mapped[int] = mapped_column(Integer, nullable=False)
    end_minute: Mapped[int] = mapped_column(Integer, nullable=False)

    checkin: Mapped[Checkin] = relationship(back_populates="commitments")


class Plan(Base):
    """The plan generated for one check-in. Screens 8 and 10."""

    __tablename__ = "plans"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    checkin_id: Mapped[str] = mapped_column(
        ForeignKey("checkins.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    status: Mapped[PlanStatus] = mapped_column(
        Enum(PlanStatus, native_enum=False, create_constraint=True, length=16),
        default=PlanStatus.PLANNED,
        nullable=False,
    )
    # Which packs produced these rules, so a plan can explain itself later.
    pack_ids: Mapped[list[str]] = mapped_column(StringList, default=list)
    fallback_reason: Mapped[str | None] = mapped_column(Text)
    generated_at: Mapped[datetime] = mapped_column(UtcTimestamp, default=utcnow)

    checkin: Mapped[Checkin] = relationship(back_populates="plan")
    blocks: Mapped[list[PlanBlock]] = relationship(
        back_populates="plan",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="PlanBlock.position",
    )


class PlanBlock(Base):
    """One suggested session. Screens 10 and 11."""

    __tablename__ = "plan_blocks"
    __table_args__ = (
        UniqueConstraint("plan_id", "position", name="uq_block_position"),
        CheckConstraint("start_minute >= 0", name="ck_block_start"),
        CheckConstraint("end_minute <= 1440", name="ck_block_end"),
        CheckConstraint("end_minute > start_minute", name="ck_block_order"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    plan_id: Mapped[str] = mapped_column(ForeignKey("plans.id", ondelete="CASCADE"), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    title: Mapped[str] = mapped_column(String(160), nullable=False)
    intensity: Mapped[Intensity] = mapped_column(
        Enum(Intensity, native_enum=False, create_constraint=True, length=16),
        nullable=False,
    )
    start_minute: Mapped[int] = mapped_column(Integer, nullable=False)
    end_minute: Mapped[int] = mapped_column(Integer, nullable=False)
    tags: Mapped[list[str]] = mapped_column(StringList, default=list)
    linked_interest: Mapped[str | None] = mapped_column(String(80))

    status: Mapped[BlockStatus] = mapped_column(
        Enum(BlockStatus, native_enum=False, create_constraint=True, length=16),
        default=BlockStatus.PLANNED,
        nullable=False,
    )

    plan: Mapped[Plan] = relationship(back_populates="blocks")
    completion: Mapped[Completion | None] = relationship(
        back_populates="block", cascade="all, delete-orphan", passive_deletes=True
    )


class Completion(Base):
    """What actually happened to a block: the evening wrap-up. Screen 14."""

    __tablename__ = "completions"
    __table_args__ = (UniqueConstraint("block_id", name="uq_completion_block"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    block_id: Mapped[str] = mapped_column(
        ForeignKey("plan_blocks.id", ondelete="CASCADE"), nullable=False
    )
    outcome: Mapped[CompletionOutcome] = mapped_column(
        Enum(CompletionOutcome, native_enum=False, create_constraint=True, length=16),
        nullable=False,
    )
    reason: Mapped[str | None] = mapped_column(String(120))
    felt_rating: Mapped[FeltRating | None] = mapped_column(
        Enum(FeltRating, native_enum=False, create_constraint=True, length=20)
    )
    recorded_at: Mapped[datetime] = mapped_column(UtcTimestamp, default=utcnow)

    block: Mapped[PlanBlock] = relationship(back_populates="completion")


class SymptomNote(Base):
    """A note the user chose to keep, e.g. from the red-flag screen. Screen 13."""

    __tablename__ = "symptom_notes"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    checkin_id: Mapped[str | None] = mapped_column(ForeignKey("checkins.id", ondelete="SET NULL"))
    note: Mapped[str] = mapped_column(Text, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(UtcTimestamp, default=utcnow)

    user: Mapped[User] = relationship(back_populates="symptom_notes")
