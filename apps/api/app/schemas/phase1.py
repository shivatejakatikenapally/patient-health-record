from datetime import date, datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class PatientProfileInput(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    date_of_birth: date | None = None

    @field_validator("full_name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Enter your full name")
        return value


class PatientProfileView(BaseModel):
    id: UUID
    full_name: str
    date_of_birth: date | None
    reference_id: str
    reference_id_issued: bool = True


class ProviderProfileInput(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    specialty: str = Field(default="", max_length=120)
    facility: str = Field(default="", max_length=160)
    registration_number: str | None = Field(default=None, max_length=100)


class ProviderProfileView(ProviderProfileInput):
    id: UUID
    verification_status: str


class RecordCategory(StrEnum):
    VISIT = "visit"
    DIAGNOSIS = "diagnosis"
    MEDICATION = "medication"
    LAB = "lab"
    VACCINATION = "vaccination"
    OTHER = "other"


class RecordInput(BaseModel):
    category: RecordCategory
    title: str = Field(min_length=2, max_length=160)
    details: str = Field(default="", max_length=8000)
    occurred_on: date

    @field_validator("title")
    @classmethod
    def trim_title(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Enter a title")
        return value


class RecordView(RecordInput):
    id: UUID
    created_at: datetime
    updated_at: datetime


class DocumentView(BaseModel):
    id: UUID
    record_id: UUID | None
    original_filename: str
    content_type: str
    size_bytes: int
    created_at: datetime


class DocumentDownloadView(BaseModel):
    url: str
    expires_in: int
