from uuid import UUID

import jwt
from fastapi import HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserRole
from app.schemas.auth import LoginInput, RegisterInput, TokenView, UserView


async def _token_view(user: User, redis: Redis) -> TokenView:
    token, session_id = create_access_token(user.id, user.role)
    await redis.set(
        f"auth:session:{session_id}", str(user.id), ex=settings.jwt_access_token_minutes * 60
    )
    return TokenView(
        access_token=token,
        user=UserView(id=str(user.id), email=user.email, role=UserRole(user.role)),
    )


async def register(session: AsyncSession, redis: Redis, payload: RegisterInput) -> TokenView:
    email = str(payload.email).lower()
    existing = await session.scalar(select(User).where(User.email == email))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account already uses this email")
    user = User(email=email, password_hash=hash_password(payload.password), role=payload.role.value)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return await _token_view(user, redis)


async def login(session: AsyncSession, redis: Redis, payload: LoginInput) -> TokenView:
    email = str(payload.email).lower()
    user = await session.scalar(select(User).where(User.email == email, User.is_active.is_(True)))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email or password is incorrect")
    return await _token_view(user, redis)


async def identify_token(token: str, session: AsyncSession, redis: Redis) -> User:
    try:
        claims = jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])
        user_id = UUID(claims["sub"])
        session_id = claims["jti"]
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session") from None
    if await redis.get(f"auth:session:{session_id}") != str(user_id):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is no longer active")
    user = await session.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is unavailable")
    return user
