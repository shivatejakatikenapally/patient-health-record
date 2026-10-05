from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import PatientUser, ProviderUser
from app.db.session import get_session
from app.schemas.consent import (
    ConsentDecisionInput,
    ConsentRequestInput,
    ConsentStatusView,
    ConsentView,
)
from app.schemas.phase1 import DocumentDownloadView, DocumentView, RecordView
from app.services.consent_service.service import (
    approve_request,
    deny_request,
    get_provider_consent_status,
    list_patient_consents,
    list_provider_consents,
    request_access,
    revoke_consent,
)
from app.services.patient_record_service.service import (
    get_document_download_for_provider as get_doc_download,
    get_documents_for_provider,
    get_patient_summary_for_provider,
    get_records_for_provider,
)
from app.worker.consent_expiry import sweep_expired_consents

router = APIRouter(prefix="/consents", tags=["consents"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.post("/requests", response_model=ConsentView)
async def create_access_request(
    payload: ConsentRequestInput,
    user: ProviderUser,
    session: SessionDep,
    request: Request,
) -> ConsentView:
    return await request_access(session, request.app.state.redis, user, payload)


@router.get("/patient", response_model=list[ConsentView])
async def get_patient_consents(
    user: PatientUser,
    session: SessionDep,
) -> list[ConsentView]:
    return await list_patient_consents(session, user)


@router.get("/provider", response_model=list[ConsentView])
async def get_provider_consents(
    user: ProviderUser,
    session: SessionDep,
) -> list[ConsentView]:
    return await list_provider_consents(session, user)


@router.get("/provider/status/{reference_id}", response_model=ConsentStatusView)
async def check_consent_status(
    reference_id: str,
    user: ProviderUser,
    session: SessionDep,
    request: Request,
) -> ConsentStatusView:
    return await get_provider_consent_status(
        session, request.app.state.redis, user, reference_id
    )


@router.post("/{consent_id}/approve", response_model=ConsentView)
async def approve_consent(
    consent_id: UUID,
    user: PatientUser,
    session: SessionDep,
    request: Request,
    decision: ConsentDecisionInput | None = None,
) -> ConsentView:
    return await approve_request(
        session, request.app.state.redis, user, consent_id, decision
    )


@router.post("/{consent_id}/deny", response_model=ConsentView)
async def deny_consent(
    consent_id: UUID,
    user: PatientUser,
    session: SessionDep,
    request: Request,
) -> ConsentView:
    return await deny_request(
        session, request.app.state.redis, user, consent_id
    )


@router.post("/{consent_id}/revoke", response_model=ConsentView)
async def revoke_active_consent(
    consent_id: UUID,
    user: PatientUser,
    session: SessionDep,
    request: Request,
) -> ConsentView:
    return await revoke_consent(
        session, request.app.state.redis, user, consent_id
    )


@router.post("/sweep", response_model=dict)
async def trigger_expiry_sweep(
    session: SessionDep,
    request: Request,
) -> dict:
    count = await sweep_expired_consents(session, request.app.state.redis)
    return {"status": "ok", "expired_count": count}


# Consented Patient Data Access Endpoints for Providers
@router.get("/patients/{reference_id}/summary", response_model=dict)
async def view_consented_patient_summary(
    reference_id: str,
    user: ProviderUser,
    session: SessionDep,
    request: Request,
) -> dict:
    return await get_patient_summary_for_provider(
        session, request.app.state.redis, user, reference_id
    )


@router.get("/patients/{reference_id}/records", response_model=list[RecordView])
async def view_consented_patient_records(
    reference_id: str,
    user: ProviderUser,
    session: SessionDep,
    request: Request,
) -> list[RecordView]:
    return await get_records_for_provider(
        session, request.app.state.redis, user, reference_id
    )


@router.get("/patients/{reference_id}/documents", response_model=list[DocumentView])
async def view_consented_patient_documents(
    reference_id: str,
    user: ProviderUser,
    session: SessionDep,
    request: Request,
) -> list[DocumentView]:
    return await get_documents_for_provider(
        session, request.app.state.redis, user, reference_id
    )


@router.get(
    "/patients/{reference_id}/documents/{document_id}/download",
    response_model=DocumentDownloadView,
)
async def download_consented_patient_document(
    reference_id: str,
    document_id: UUID,
    user: ProviderUser,
    session: SessionDep,
    request: Request,
) -> DocumentDownloadView:
    return await get_doc_download(
        session, request.app.state.redis, user, reference_id, document_id
    )
