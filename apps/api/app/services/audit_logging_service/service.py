from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


def log_event(session: AsyncSession, *, actor_user_id: UUID, patient_id: UUID | None,
              action: str, resource_type: str, resource_id: UUID | None = None,
              details: dict | None = None) -> None:
    """Append a metadata-only audit event to the transaction being performed."""
    session.add(AuditLog(actor_user_id=actor_user_id, patient_id=patient_id, action=action,
                         resource_type=resource_type, resource_id=resource_id, details=details or {}))
