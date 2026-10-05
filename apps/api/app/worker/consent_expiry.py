import asyncio
import logging
from datetime import datetime, timezone

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import SessionFactory
from app.models.consent import Consent, ConsentState
from app.services.audit_logging_service.service import log_event

logger = logging.getLogger(__name__)


async def sweep_expired_consents(session: AsyncSession, redis: Redis) -> int:
    now = datetime.now(timezone.utc)
    stmt = (
        select(Consent)
        .where(
            Consent.status == ConsentState.GRANTED.value,
            Consent.expires_at <= now,
        )
    )
    items = await session.scalars(stmt)
    expired = list(items)

    for item in expired:
        item.status = ConsentState.EXPIRED.value
        cache_key = f"consent:{item.patient_id}:{item.provider_id}"
        await redis.delete(cache_key)
        log_event(
            session,
            actor_user_id=None,
            patient_id=item.patient_id,
            action="consent_expired",
            resource_type="consent",
            resource_id=item.id,
            details={"expired_at": now.isoformat()},
        )

    if expired:
        await session.commit()
        logger.info(f"Swept and expired {len(expired)} active consents.")

    return len(expired)


async def run_expiry_sweep_worker(redis: Redis, interval_seconds: int = 60) -> None:
    """Background loop that periodically sweeps expired consents."""
    while True:
        try:
            async with SessionFactory() as session:
                await sweep_expired_consents(session, redis)
        except Exception as e:
            logger.error(f"Error in consent expiry worker sweep: {e}")
        await asyncio.sleep(interval_seconds)
