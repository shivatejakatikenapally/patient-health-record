from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


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


class ConsentRequestInput(BaseModel):
    patient_reference_id: str = Field(min_length=5, max_length=30)
    purpose: ConsentPurpose = ConsentPurpose.TREATMENT
    duration_minutes: int = Field(default=60, ge=5, le=10080)

    @field_validator("patient_reference_id")
    @classmethod
    def clean_ref_id(cls, value: str) -> str:
        value = value.strip().upper()
        if not value:
            raise ValueError("Patient reference ID is required")
        return value


class ConsentDecisionInput(BaseModel):
    duration_minutes: int | None = Field(default=None, ge=5, le=10080)
    purpose: ConsentPurpose | None = None


class ConsentView(BaseModel):
    id: UUID
    patient_id: UUID
    patient_reference_id: str
    patient_name: str
    provider_id: UUID
    provider_name: str
    provider_specialty: str
    provider_facility: str
    purpose: ConsentPurpose
    duration_minutes: int
    status: ConsentState
    granted_at: datetime | None = None
    expires_at: datetime | None = None
    revoked_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ConsentStatusView(BaseModel):
    has_active_consent: bool
    consent_id: UUID | None = None
    status: ConsentState
    purpose: ConsentPurpose | None = None
    expires_at: datetime | None = None
    time_remaining_seconds: int | None = None
