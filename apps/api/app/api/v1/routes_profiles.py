import secrets
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import PatientUser, ProviderUser
from app.db.session import get_session
from app.models.patient import PatientProfile
from app.models.provider import ProviderProfile
from app.schemas.phase1 import PatientProfileInput, PatientProfileView, ProviderProfileInput, ProviderProfileView
from app.services.audit_logging_service.service import log_event

router = APIRouter(tags=["profiles"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("/patients/me/profile", response_model=PatientProfileView)
async def patient_profile(user: PatientUser, session: SessionDep) -> PatientProfileView:
    profile = await session.scalar(select(PatientProfile).where(PatientProfile.user_id == user.id))
    if profile is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Patient profile not created")
    log_event(session, actor_user_id=user.id, patient_id=profile.id, action="profile_viewed", resource_type="patient_profile", resource_id=profile.id)
    await session.commit()
    return PatientProfileView(id=profile.id, full_name=profile.full_name, date_of_birth=profile.date_of_birth,
                              reference_id=profile.reference_id)


@router.put("/patients/me/profile", response_model=PatientProfileView)
async def save_patient_profile(payload: PatientProfileInput, user: PatientUser, session: SessionDep) -> PatientProfileView:
    profile = await session.scalar(select(PatientProfile).where(PatientProfile.user_id == user.id))
    if profile is None:
        profile = PatientProfile(user_id=user.id, reference_id=f"PHR-{secrets.token_hex(5).upper()}",
                                 full_name=payload.full_name, date_of_birth=payload.date_of_birth)
        session.add(profile)
    else:
        profile.full_name = payload.full_name
        profile.date_of_birth = payload.date_of_birth
    await session.flush()
    log_event(session, actor_user_id=user.id, patient_id=profile.id, action="profile_saved", resource_type="patient_profile", resource_id=profile.id)
    await session.commit()
    await session.refresh(profile)
    return PatientProfileView(id=profile.id, full_name=profile.full_name, date_of_birth=profile.date_of_birth,
                              reference_id=profile.reference_id)


@router.get("/providers/me/profile", response_model=ProviderProfileView)
async def provider_profile(user: ProviderUser, session: SessionDep) -> ProviderProfileView:
    profile = await session.scalar(select(ProviderProfile).where(ProviderProfile.user_id == user.id))
    if profile is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Provider profile not created")
    log_event(session, actor_user_id=user.id, patient_id=None, action="profile_viewed", resource_type="provider_profile", resource_id=profile.id)
    await session.commit()
    return ProviderProfileView(id=profile.id, full_name=profile.full_name, specialty=profile.specialty,
                               facility=profile.facility, registration_number=profile.registration_number,
                               verification_status=profile.verification_status)


@router.put("/providers/me/profile", response_model=ProviderProfileView)
async def save_provider_profile(payload: ProviderProfileInput, user: ProviderUser, session: SessionDep) -> ProviderProfileView:
    profile = await session.scalar(select(ProviderProfile).where(ProviderProfile.user_id == user.id))
    values = payload.model_dump()
    if profile is None:
        profile = ProviderProfile(user_id=user.id, **values)
        session.add(profile)
    else:
        for field, value in values.items():
            setattr(profile, field, value)
    await session.flush()
    log_event(session, actor_user_id=user.id, patient_id=None, action="profile_saved", resource_type="provider_profile", resource_id=profile.id)
    await session.commit()
    await session.refresh(profile)
    return ProviderProfileView(id=profile.id, full_name=profile.full_name, specialty=profile.specialty,
                               facility=profile.facility, registration_number=profile.registration_number,
                               verification_status=profile.verification_status)
