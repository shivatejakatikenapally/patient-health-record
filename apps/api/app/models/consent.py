from datetime import datetime, timezone
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ConsentPurpose(StrEnum):
    TREATMENT = "treatment"
    CARE_COORDINATION = "care_coordination"
    DIAGNOSTIC_REVIEW = "diagnostic_review"
    EMERGENCY_BREAK_GLASS = "emergency_break_glass"


class ConsentState(StrEnum):
    PENDING = "pending"
    GRANTED = "granted"
    DENIED = "denied"
    REVOKED = "revoked"
    EXPIRED = "expired"


class Consent(Base):
    __tablename__ = "consents"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    patient_id: Mapped[UUID] = mapped_column(ForeignKey("patient_profiles.id", ondelete="CASCADE"), index=True)
    provider_id: Mapped[UUID] = mapped_column(ForeignKey("provider_profiles.id", ondelete="CASCADE"), index=True)
    purpose: Mapped[str] = mapped_column(String(40), default=ConsentPurpose.TREATMENT.value)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    status: Mapped[str] = mapped_column(String(20), default=ConsentState.PENDING.value, index=True)
    granted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    patient: Mapped["PatientProfile"] = relationship("PatientProfile", back_populates="consents")
    provider: Mapped["ProviderProfile"] = relationship("ProviderProfile", back_populates="consents")
