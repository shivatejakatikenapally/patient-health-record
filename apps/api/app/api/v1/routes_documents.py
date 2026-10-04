from pathlib import PurePosixPath
from typing import Annotated
from urllib.parse import quote, unquote
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import PatientUser
from app.db.session import get_session
from app.models.document import PatientDocument
from app.models.patient import PatientProfile
from app.models.record import HealthRecord
from app.schemas.phase1 import DocumentDownloadView, DocumentView
from app.core.config import settings
from app.services.audit_logging_service.service import log_event

router = APIRouter(prefix="/documents", tags=["patient documents"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]
MAX_BYTES = 8 * 1024 * 1024
ALLOWED_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp"}


def storage_headers() -> dict[str, str]:
    key = settings.supabase_service_role_key
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def storage_object_url(path: str) -> str:
    safe_path = "/".join(quote(part, safe="") for part in path.split("/"))
    return f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{quote(settings.supabase_storage_bucket, safe='')}/{safe_path}"


async def remove_storage_object(path: str) -> None:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.delete(
            f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{quote(settings.supabase_storage_bucket, safe='')}",
            headers={**storage_headers(), "Content-Type": "application/json"},
            json={"prefixes": [path]},
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Stored file could not be removed")


async def get_profile(session: AsyncSession, user_id: UUID) -> PatientProfile:
    profile = await session.scalar(select(PatientProfile).where(PatientProfile.user_id == user_id))
    if not profile:
        raise HTTPException(status_code=409, detail="Create your patient profile before uploading documents")
    return profile


def document_view(item: PatientDocument) -> DocumentView:
    return DocumentView(id=item.id, record_id=item.record_id, original_filename=item.original_filename,
                        content_type=item.content_type, size_bytes=item.size_bytes, created_at=item.created_at)


@router.get("", response_model=list[DocumentView])
async def list_documents(user: PatientUser, session: SessionDep) -> list[DocumentView]:
    profile = await get_profile(session, user.id)
    items = await session.scalars(select(PatientDocument).where(PatientDocument.patient_id == profile.id).order_by(PatientDocument.created_at.desc()))
    documents = list(items)
    log_event(session, actor_user_id=user.id, patient_id=profile.id, action="document_listed", resource_type="patient_document", details={"count": len(documents)})
    await session.commit()
    return [document_view(item) for item in documents]


@router.post("", response_model=DocumentView, status_code=status.HTTP_201_CREATED)
async def upload_document(request: Request, user: PatientUser, session: SessionDep,
                          record_id: UUID | None = None) -> DocumentView:
    profile = await get_profile(session, user.id)
    content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Upload a PDF, JPEG, PNG, or WebP document")
    if record_id and not await session.scalar(select(HealthRecord.id).where(HealthRecord.id == record_id, HealthRecord.patient_id == profile.id)):
        raise HTTPException(status_code=404, detail="Linked record not found")

    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_BYTES:
            raise HTTPException(status_code=413, detail="Document must be 8 MB or smaller")
        chunks.append(chunk)
    if not size:
        raise HTTPException(status_code=400, detail="The selected file is empty")

    supplied_name = unquote(request.headers.get("x-file-name", "document"))
    filename = PurePosixPath(supplied_name.replace("\\", "/")).name.strip()[:255] or "document"
    document_id = uuid4()
    suffix = PurePosixPath(filename).suffix.lower()[:12]
    path = f"{profile.id}/{document_id}{suffix}"
    payload = b"".join(chunks)
    valid_signature = {
        "application/pdf": payload.startswith(b"%PDF-"),
        "image/jpeg": payload.startswith(b"\xff\xd8\xff"),
        "image/png": payload.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/webp": len(payload) >= 12 and payload.startswith(b"RIFF") and payload[8:12] == b"WEBP",
    }[content_type]
    if not valid_signature:
        raise HTTPException(status_code=415, detail="The file contents do not match the selected document type")
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(storage_object_url(path), headers={**storage_headers(), "Content-Type": content_type, "x-upsert": "false"}, content=payload)
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail="Private document storage could not accept the upload")
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Private document storage is unavailable") from exc

    item = PatientDocument(id=document_id, patient_id=profile.id, record_id=record_id,
                           original_filename=filename, storage_path=path, content_type=content_type, size_bytes=size)
    session.add(item)
    try:
        await session.flush()
        log_event(session, actor_user_id=user.id, patient_id=profile.id, action="document_uploaded", resource_type="patient_document", resource_id=item.id, details={"content_type": content_type, "size_bytes": size})
        await session.commit()
        await session.refresh(item)
    except Exception:
        await session.rollback()
        try:
            await remove_storage_object(path)
        except httpx.HTTPError:
            pass
        raise
    return document_view(item)


@router.get("/{document_id}/download", response_model=DocumentDownloadView)
async def get_download_link(document_id: UUID, user: PatientUser, session: SessionDep) -> DocumentDownloadView:
    profile = await get_profile(session, user.id)
    item = await session.scalar(select(PatientDocument).where(PatientDocument.id == document_id, PatientDocument.patient_id == profile.id))
    if not item:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
                        response = await client.post(storage_object_url(item.storage_path).replace("/storage/v1/object/", "/storage/v1/object/sign/", 1), headers={**storage_headers(), "Content-Type": "application/json"}, json={"expiresIn": 300})
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail="A temporary download link could not be created")
        signed_path = response.json()["signedURL"]
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        raise HTTPException(status_code=502, detail="Private document storage is unavailable") from exc
    if signed_path.startswith("http"):
        url = signed_path
    else:
        url = f"{settings.supabase_url.rstrip('/')}{signed_path if signed_path.startswith('/') else '/' + signed_path}"
    log_event(session, actor_user_id=user.id, patient_id=profile.id, action="document_download_link_created", resource_type="patient_document", resource_id=item.id)
    await session.commit()
    return DocumentDownloadView(url=url, expires_in=300)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: UUID, user: PatientUser, session: SessionDep) -> Response:
    profile = await get_profile(session, user.id)
    item = await session.scalar(select(PatientDocument).where(PatientDocument.id == document_id, PatientDocument.patient_id == profile.id))
    if not item:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        await remove_storage_object(item.storage_path)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Private document storage is unavailable") from exc
    await session.delete(item)
    log_event(session, actor_user_id=user.id, patient_id=profile.id, action="document_deleted", resource_type="patient_document", resource_id=item.id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
