from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import PatientUser, ProviderUser
from app.db.session import get_session
from app.models.audit_log import AuditLog
from app.models.patient import PatientProfile

router = APIRouter(prefix="/audit", tags=["audit"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


class AuditLogView(BaseModel):
    id: UUID
    actor_user_id: UUID | None
    patient_id: UUID | None
    action: str
    resource_type: str
    resource_id: UUID | None
    details: dict
    created_at: datetime


@router.get("/patient", response_model=list[AuditLogView])
async def get_patient_audit_trail(
    user: PatientUser,
    session: SessionDep,
) -> list[AuditLogView]:
    profile = await session.scalar(
        select(PatientProfile).where(PatientProfile.user_id == user.id)
    )
    if not profile:
        return []
    items = await session.scalars(
        select(AuditLog)
        .where(AuditLog.patient_id == profile.id)
        .order_by(AuditLog.created_at.desc())
        .limit(100)
    )
    return [
        AuditLogView(
            id=item.id,
            actor_user_id=item.actor_user_id,
            patient_id=item.patient_id,
            action=item.action,
            resource_type=item.resource_type,
            resource_id=item.resource_id,
            details=item.details,
            created_at=item.created_at,
        )
        for item in items
    ]


@router.get("/provider", response_model=list[AuditLogView])
async def get_provider_audit_trail(
    user: ProviderUser,
    session: SessionDep,
) -> list[AuditLogView]:
    items = await session.scalars(
        select(AuditLog)
        .where(AuditLog.actor_user_id == user.id)
        .order_by(AuditLog.created_at.desc())
        .limit(100)
    )
    return [
        AuditLogView(
            id=item.id,
            actor_user_id=item.actor_user_id,
            patient_id=item.patient_id,
            action=item.action,
            resource_type=item.resource_type,
            resource_id=item.resource_id,
            details=item.details,
            created_at=item.created_at,
        )
        for item in items
    ]
