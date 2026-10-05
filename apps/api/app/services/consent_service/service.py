from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.consent import Consent, ConsentPurpose, ConsentState
from app.models.patient import PatientProfile
from app.models.provider import ProviderProfile
from app.models.user import User
from app.schemas.consent import (
    ConsentDecisionInput,
    ConsentRequestInput,
    ConsentStatusView,
    ConsentView,
)
from app.services.audit_logging_service.service import log_event


def _to_view(item: Consent) -> ConsentView:
    return ConsentView(
        id=item.id,
        patient_id=item.patient_id,
        patient_reference_id=item.patient.reference_id if item.patient else "",
        patient_name=item.patient.full_name if item.patient else "Patient",
        provider_id=item.provider_id,
        provider_name=item.provider.full_name if item.provider else "Provider",
        provider_specialty=item.provider.specialty if item.provider else "",
        provider_facility=item.provider.facility if item.provider else "",
        purpose=ConsentPurpose(item.purpose),
        duration_minutes=item.duration_minutes,
        status=ConsentState(item.status),
        granted_at=item.granted_at,
        expires_at=item.expires_at,
        revoked_at=item.revoked_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


async def _get_provider_profile(session: AsyncSession, user_id: UUID) -> ProviderProfile:
    profile = await session.scalar(select(ProviderProfile).where(ProviderProfile.user_id == user_id))
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider profile not created. Please complete your profile first.",
        )
    return profile


async def _get_patient_profile(session: AsyncSession, user_id: UUID) -> PatientProfile:
    profile = await session.scalar(select(PatientProfile).where(PatientProfile.user_id == user_id))
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not created. Please complete your profile first.",
        )
    return profile


async def request_access(
    session: AsyncSession,
    redis: Redis,
    user: User,
    payload: ConsentRequestInput,
) -> ConsentView:
    provider = await _get_provider_profile(session, user.id)
    ref_id = payload.patient_reference_id.strip().upper()
    patient = await session.scalar(select(PatientProfile).where(PatientProfile.reference_id == ref_id))
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No patient record found matching reference ID '{ref_id}'.",
        )

    now = datetime.now(timezone.utc)

    # Check for existing active or pending consent
    existing = await session.scalar(
        select(Consent)
        .options(selectinload(Consent.patient), selectinload(Consent.provider))
        .where(
            Consent.patient_id == patient.id,
            Consent.provider_id == provider.id,
            or_(
                Consent.status == ConsentState.PENDING.value,
                (Consent.status == ConsentState.GRANTED.value) & (Consent.expires_at > now),
            ),
        )
        .order_by(Consent.created_at.desc())
    )

    if existing:
        if existing.status == ConsentState.GRANTED.value:
            return _to_view(existing)
        # Update existing pending request
        existing.purpose = payload.purpose.value
        existing.duration_minutes = payload.duration_minutes
        log_event(
            session,
            actor_user_id=user.id,
            patient_id=patient.id,
            action="consent_request_updated",
            resource_type="consent",
            resource_id=existing.id,
            details={"purpose": payload.purpose.value, "duration_minutes": payload.duration_minutes},
        )
        await session.commit()
        await session.refresh(existing)
        return _to_view(existing)

    consent = Consent(
        patient_id=patient.id,
        provider_id=provider.id,
        purpose=payload.purpose.value,
        duration_minutes=payload.duration_minutes,
        status=ConsentState.PENDING.value,
    )
    session.add(consent)
    await session.flush()

    log_event(
        session,
        actor_user_id=user.id,
        patient_id=patient.id,
        action="consent_requested",
        resource_type="consent",
        resource_id=consent.id,
        details={
            "purpose": payload.purpose.value,
            "duration_minutes": payload.duration_minutes,
            "provider_name": provider.full_name,
            "facility": provider.facility,
        },
    )
    await session.commit()

    # Re-fetch with relationships
    item = await session.scalar(
        select(Consent)
        .options(selectinload(Consent.patient), selectinload(Consent.provider))
        .where(Consent.id == consent.id)
    )
    return _to_view(item or consent)


async def approve_request(
    session: AsyncSession,
    redis: Redis,
    user: User,
    consent_id: UUID,
    decision: ConsentDecisionInput | None = None,
) -> ConsentView:
    patient = await _get_patient_profile(session, user.id)
    consent = await session.scalar(
        select(Consent)
        .options(selectinload(Consent.patient), selectinload(Consent.provider))
        .where(Consent.id == consent_id, Consent.patient_id == patient.id)
    )
    if not consent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consent request not found.",
        )
    if consent.status != ConsentState.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve request with current status '{consent.status}'.",
        )

    now = datetime.now(timezone.utc)
    duration = (
        decision.duration_minutes if (decision and decision.duration_minutes) else consent.duration_minutes
    )
    purpose = decision.purpose.value if (decision and decision.purpose) else consent.purpose
    expires_at = now + timedelta(minutes=duration)

    consent.status = ConsentState.GRANTED.value
    consent.granted_at = now
    consent.expires_at = expires_at
    consent.duration_minutes = duration
    consent.purpose = purpose

    # Cache fast status in Redis
    cache_key = f"consent:{consent.patient_id}:{consent.provider_id}"
    await redis.set(cache_key, ConsentState.GRANTED.value, ex=duration * 60)

    log_event(
        session,
        actor_user_id=user.id,
        patient_id=patient.id,
        action="consent_granted",
        resource_type="consent",
        resource_id=consent.id,
        details={
            "purpose": purpose,
            "duration_minutes": duration,
            "expires_at": expires_at.isoformat(),
        },
    )
    await session.commit()
    await session.refresh(consent)
    return _to_view(consent)


async def deny_request(
    session: AsyncSession,
    redis: Redis,
    user: User,
    consent_id: UUID,
) -> ConsentView:
    patient = await _get_patient_profile(session, user.id)
    consent = await session.scalar(
        select(Consent)
        .options(selectinload(Consent.patient), selectinload(Consent.provider))
        .where(Consent.id == consent_id, Consent.patient_id == patient.id)
    )
    if not consent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consent request not found.",
        )
    if consent.status != ConsentState.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot deny request with current status '{consent.status}'.",
        )

    consent.status = ConsentState.DENIED.value
    consent.expires_at = None

    cache_key = f"consent:{consent.patient_id}:{consent.provider_id}"
    await redis.delete(cache_key)

    log_event(
        session,
        actor_user_id=user.id,
        patient_id=patient.id,
        action="consent_denied",
        resource_type="consent",
        resource_id=consent.id,
    )
    await session.commit()
    await session.refresh(consent)
    return _to_view(consent)


async def revoke_consent(
    session: AsyncSession,
    redis: Redis,
    user: User,
    consent_id: UUID,
) -> ConsentView:
    patient = await _get_patient_profile(session, user.id)
    consent = await session.scalar(
        select(Consent)
        .options(selectinload(Consent.patient), selectinload(Consent.provider))
        .where(Consent.id == consent_id, Consent.patient_id == patient.id)
    )
    if not consent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consent record not found.",
        )
    if consent.status != ConsentState.GRANTED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot revoke consent in '{consent.status}' status.",
        )

    now = datetime.now(timezone.utc)
    consent.status = ConsentState.REVOKED.value
    consent.revoked_at = now

    # Immediate cache invalidation so next read is blocked instantly
    cache_key = f"consent:{consent.patient_id}:{consent.provider_id}"
    await redis.delete(cache_key)

    log_event(
        session,
        actor_user_id=user.id,
        patient_id=patient.id,
        action="consent_revoked",
        resource_type="consent",
        resource_id=consent.id,
        details={"revoked_at": now.isoformat()},
    )
    await session.commit()
    await session.refresh(consent)
    return _to_view(consent)


async def list_patient_consents(
    session: AsyncSession,
    user: User,
) -> list[ConsentView]:
    patient = await _get_patient_profile(session, user.id)
    items = await session.scalars(
        select(Consent)
        .options(selectinload(Consent.patient), selectinload(Consent.provider))
        .where(Consent.patient_id == patient.id)
        .order_by(Consent.created_at.desc())
    )
    return [_to_view(item) for item in items]


async def list_provider_consents(
    session: AsyncSession,
    user: User,
) -> list[ConsentView]:
    provider = await _get_provider_profile(session, user.id)
    items = await session.scalars(
        select(Consent)
        .options(selectinload(Consent.patient), selectinload(Consent.provider))
        .where(Consent.provider_id == provider.id)
        .order_by(Consent.created_at.desc())
    )
    return [_to_view(item) for item in items]


async def check_active_consent(
    session: AsyncSession,
    redis: Redis,
    provider_id: UUID,
    patient_id: UUID,
) -> Consent | None:
    now = datetime.now(timezone.utc)
    consent = await session.scalar(
        select(Consent)
        .options(selectinload(Consent.patient), selectinload(Consent.provider))
        .where(
            Consent.provider_id == provider_id,
            Consent.patient_id == patient_id,
            Consent.status == ConsentState.GRANTED.value,
        )
        .order_by(Consent.expires_at.desc())
    )

    if not consent:
        return None

    if consent.expires_at and consent.expires_at <= now:
        consent.status = ConsentState.EXPIRED.value
        cache_key = f"consent:{patient_id}:{provider_id}"
        await redis.delete(cache_key)
        log_event(
            session,
            actor_user_id=None,
            patient_id=patient_id,
            action="consent_expired",
            resource_type="consent",
            resource_id=consent.id,
        )
        await session.commit()
        return None

    return consent


async def get_provider_consent_status(
    session: AsyncSession,
    redis: Redis,
    user: User,
    reference_id: str,
) -> ConsentStatusView:
    provider = await _get_provider_profile(session, user.id)
    ref_id = reference_id.strip().upper()
    patient = await session.scalar(select(PatientProfile).where(PatientProfile.reference_id == ref_id))
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No patient record found matching reference ID '{ref_id}'.",
        )

    consent = await check_active_consent(session, redis, provider.id, patient.id)
    if not consent:
        # Check if there is a pending request
        pending = await session.scalar(
            select(Consent).where(
                Consent.provider_id == provider.id,
                Consent.patient_id == patient.id,
                Consent.status == ConsentState.PENDING.value,
            )
        )
        if pending:
            return ConsentStatusView(
                has_active_consent=False,
                consent_id=pending.id,
                status=ConsentState.PENDING,
                purpose=ConsentPurpose(pending.purpose),
            )
        return ConsentStatusView(
            has_active_consent=False,
            status=ConsentState.DENIED,
        )

    now = datetime.now(timezone.utc)
    remaining = int((consent.expires_at - now).total_seconds()) if consent.expires_at else None
    return ConsentStatusView(
        has_active_consent=True,
        consent_id=consent.id,
        status=ConsentState.GRANTED,
        purpose=ConsentPurpose(consent.purpose),
        expires_at=consent.expires_at,
        time_remaining_seconds=max(0, remaining) if remaining is not None else None,
    )
