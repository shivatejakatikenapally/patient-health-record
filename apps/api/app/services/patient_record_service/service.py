from typing import Tuple
from uuid import UUID
import httpx
from fastapi import HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.consent import Consent
from app.models.document import PatientDocument
from app.models.patient import PatientProfile
from app.models.provider import ProviderProfile
from app.models.record import HealthRecord
from app.models.user import User
from app.schemas.phase1 import DocumentDownloadView, DocumentView, RecordView
from app.services.audit_logging_service.service import log_event
from app.services.consent_service.service import check_active_consent


async def _resolve_provider_and_patient(
    session: AsyncSession,
    redis: Redis,
    provider_user: User,
    reference_id: str,
) -> Tuple[ProviderProfile, PatientProfile, Consent]:
    provider = await session.scalar(
        select(ProviderProfile).where(ProviderProfile.user_id == provider_user.id)
    )
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider profile not found.",
        )

    ref_id = reference_id.strip().upper()
    patient = await session.scalar(
        select(PatientProfile).where(PatientProfile.reference_id == ref_id)
    )
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with reference ID '{ref_id}' not found.",
        )

    consent = await check_active_consent(session, redis, provider.id, patient.id)
    if not consent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have active, approved consent to view this patient's records.",
        )

    return provider, patient, consent


async def get_patient_summary_for_provider(
    session: AsyncSession,
    redis: Redis,
    provider_user: User,
    reference_id: str,
) -> dict:
    provider, patient, consent = await _resolve_provider_and_patient(
        session, redis, provider_user, reference_id
    )

    log_event(
        session,
        actor_user_id=provider_user.id,
        patient_id=patient.id,
        action="patient_summary_viewed",
        resource_type="patient_profile",
        resource_id=patient.id,
        details={
            "consent_id": str(consent.id),
            "purpose": consent.purpose,
            "provider_name": provider.full_name,
        },
    )
    await session.commit()

    return {
        "id": patient.id,
        "full_name": patient.full_name,
        "date_of_birth": patient.date_of_birth,
        "reference_id": patient.reference_id,
        "consent_id": consent.id,
        "consent_purpose": consent.purpose,
        "consent_expires_at": consent.expires_at,
    }


async def get_records_for_provider(
    session: AsyncSession,
    redis: Redis,
    provider_user: User,
    reference_id: str,
) -> list[RecordView]:
    provider, patient, consent = await _resolve_provider_and_patient(
        session, redis, provider_user, reference_id
    )

    items = await session.scalars(
        select(HealthRecord)
        .where(HealthRecord.patient_id == patient.id)
        .order_by(HealthRecord.occurred_on.desc(), HealthRecord.created_at.desc())
    )
    records = list(items)

    log_event(
        session,
        actor_user_id=provider_user.id,
        patient_id=patient.id,
        action="records_viewed_by_provider",
        resource_type="health_record",
        details={
            "consent_id": str(consent.id),
            "purpose": consent.purpose,
            "count": len(records),
        },
    )
    await session.commit()

    return [
        RecordView(
            id=r.id,
            category=r.category,
            title=r.title,
            details=r.details,
            occurred_on=r.occurred_on,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in records
    ]


async def get_documents_for_provider(
    session: AsyncSession,
    redis: Redis,
    provider_user: User,
    reference_id: str,
) -> list[DocumentView]:
    provider, patient, consent = await _resolve_provider_and_patient(
        session, redis, provider_user, reference_id
    )

    items = await session.scalars(
        select(PatientDocument)
        .where(PatientDocument.patient_id == patient.id)
        .order_by(PatientDocument.created_at.desc())
    )
    documents = list(items)

    log_event(
        session,
        actor_user_id=provider_user.id,
        patient_id=patient.id,
        action="documents_viewed_by_provider",
        resource_type="patient_document",
        details={
            "consent_id": str(consent.id),
            "purpose": consent.purpose,
            "count": len(documents),
        },
    )
    await session.commit()

    return [
        DocumentView(
            id=d.id,
            record_id=d.record_id,
            original_filename=d.original_filename,
            content_type=d.content_type,
            size_bytes=d.size_bytes,
            created_at=d.created_at,
        )
        for d in documents
    ]


async def get_document_download_for_provider(
    session: AsyncSession,
    redis: Redis,
    provider_user: User,
    reference_id: str,
    document_id: UUID,
) -> DocumentDownloadView:
    provider, patient, consent = await _resolve_provider_and_patient(
        session, redis, provider_user, reference_id
    )

    item = await session.scalar(
        select(PatientDocument).where(
            PatientDocument.id == document_id,
            PatientDocument.patient_id == patient.id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Document not found.")

    key = settings.supabase_service_role_key
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    sign_url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/sign/{settings.supabase_storage_bucket}/{item.storage_path}"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(sign_url, headers=headers, json={"expiresIn": 300})
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail="A temporary download link could not be created")
        signed_path = response.json()["signedURL"]
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        raise HTTPException(status_code=502, detail="Private document storage is unavailable") from exc

    if signed_path.startswith("http"):
        url = signed_path
    else:
        url = f"{settings.supabase_url.rstrip('/')}/storage/v1{signed_path if signed_path.startswith('/') else '/' + signed_path}"

    log_event(
        session,
        actor_user_id=provider_user.id,
        patient_id=patient.id,
        action="document_downloaded_by_provider",
        resource_type="patient_document",
        resource_id=item.id,
        details={
            "consent_id": str(consent.id),
            "purpose": consent.purpose,
            "filename": item.original_filename,
        },
    )
    await session.commit()

    return DocumentDownloadView(url=url, expires_in=300)
