import asyncio
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from redis.asyncio import Redis
from sqlalchemy import text

from app.api.v1.routes_audit import router as audit_router
from app.api.v1.routes_auth import router as auth_router
from app.api.v1.routes_consent import router as consent_router
from app.api.v1.routes_documents import router as documents_router
from app.api.v1.routes_profiles import router as profiles_router
from app.api.v1.routes_records import router as records_router
from app.core.config import settings
from app.db.session import SessionFactory, engine
from app.worker.consent_expiry import run_expiry_sweep_worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = Redis.from_url(settings.redis_url, decode_responses=True)
    sweep_task = asyncio.create_task(run_expiry_sweep_worker(app.state.redis, interval_seconds=60))
    yield
    sweep_task.cancel()
    try:
        await sweep_task
    except asyncio.CancelledError:
        pass
    await app.state.redis.aclose()
    await engine.dispose()


app = FastAPI(title=settings.app_name, version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.web_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-File-Name"],
)
app.include_router(auth_router, prefix=settings.api_v1_prefix)
app.include_router(profiles_router, prefix=settings.api_v1_prefix)
app.include_router(records_router, prefix=settings.api_v1_prefix)
app.include_router(documents_router, prefix=settings.api_v1_prefix)
app.include_router(consent_router, prefix=settings.api_v1_prefix)
app.include_router(audit_router, prefix=settings.api_v1_prefix)


@app.get("/health/live", tags=["health"])
async def live() -> dict[str, str]:
    return {"status": "alive"}


@app.get("/health/ready", tags=["health"])
async def ready() -> dict[str, str]:
    try:
        async with SessionFactory() as session:
            await session.execute(text("select 1"))
        await app.state.redis.ping()
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(
                f"{settings.supabase_url.rstrip('/')}/storage/v1/bucket/{settings.supabase_storage_bucket}",
                headers={"apikey": settings.supabase_service_role_key},
            )
        if response.status_code >= 400:
            raise RuntimeError("Storage bucket health check failed")
    except Exception as exc:
        raise HTTPException(status_code=503, detail="A configured hosted dependency is unavailable") from exc
    return {"status": "ready", "database": "ok", "cache": "ok", "object_storage": "ok"}
