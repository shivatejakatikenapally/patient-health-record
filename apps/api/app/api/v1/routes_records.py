from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import PatientUser
from app.db.session import get_session
from app.models.patient import PatientProfile
from app.models.record import HealthRecord
from app.schemas.phase1 import RecordInput, RecordView
from app.services.audit_logging_service.service import log_event

router = APIRouter(prefix="/records", tags=["patient records"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def get_profile(session: AsyncSession, user_id: UUID) -> PatientProfile:
    profile = await session.scalar(select(PatientProfile).where(PatientProfile.user_id == user_id))
    if not profile:
        raise HTTPException(status_code=409, detail="Create your patient profile before adding records")
    return profile


def view(record: HealthRecord) -> RecordView:
    return RecordView(id=record.id, category=record.category, title=record.title, details=record.details,
                      occurred_on=record.occurred_on, created_at=record.created_at, updated_at=record.updated_at)


@router.get("", response_model=list[RecordView])
async def list_records(user: PatientUser, session: SessionDep) -> list[RecordView]:
    profile = await get_profile(session, user.id)
    items = await session.scalars(select(HealthRecord).where(HealthRecord.patient_id == profile.id).order_by(HealthRecord.occurred_on.desc(), HealthRecord.created_at.desc()))
    records = list(items)
    log_event(session, actor_user_id=user.id, patient_id=profile.id, action="record_listed", resource_type="health_record", details={"count": len(records)})
    await session.commit()
    return [view(item) for item in records]


@router.post("", response_model=RecordView, status_code=status.HTTP_201_CREATED)
async def create_record(payload: RecordInput, user: PatientUser, session: SessionDep) -> RecordView:
    profile = await get_profile(session, user.id)
    record = HealthRecord(patient_id=profile.id, category=payload.category.value, title=payload.title,
                          details=payload.details, occurred_on=payload.occurred_on)
    session.add(record)
    await session.flush()
    log_event(session, actor_user_id=user.id, patient_id=profile.id, action="record_created", resource_type="health_record", resource_id=record.id)
    await session.commit()
    await session.refresh(record)
    return view(record)


@router.get("/{record_id}", response_model=RecordView)
async def get_record(record_id: UUID, user: PatientUser, session: SessionDep) -> RecordView:
    profile = await get_profile(session, user.id)
    record = await session.scalar(select(HealthRecord).where(HealthRecord.id == record_id, HealthRecord.patient_id == profile.id))
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    log_event(session, actor_user_id=user.id, patient_id=profile.id, action="record_viewed", resource_type="health_record", resource_id=record.id)
    await session.commit()
    return view(record)


@router.patch("/{record_id}", response_model=RecordView)
async def update_record(record_id: UUID, payload: RecordInput, user: PatientUser, session: SessionDep) -> RecordView:
    profile = await get_profile(session, user.id)
    record = await session.scalar(select(HealthRecord).where(HealthRecord.id == record_id, HealthRecord.patient_id == profile.id))
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    record.category = payload.category.value
    record.title = payload.title
    record.details = payload.details
    record.occurred_on = payload.occurred_on
    log_event(session, actor_user_id=user.id, patient_id=profile.id, action="record_updated", resource_type="health_record", resource_id=record.id)
    await session.commit()
    await session.refresh(record)
    return view(record)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_record(record_id: UUID, user: PatientUser, session: SessionDep) -> Response:
    profile = await get_profile(session, user.id)
    record = await session.scalar(select(HealthRecord).where(HealthRecord.id == record_id, HealthRecord.patient_id == profile.id))
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    log_event(session, actor_user_id=user.id, patient_id=profile.id, action="record_deleted", resource_type="health_record", resource_id=record.id)
    await session.delete(record)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
