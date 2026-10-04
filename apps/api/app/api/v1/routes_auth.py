from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.user import User
from app.schemas.auth import LoginInput, RegisterInput, TokenView, UserView
from app.services.auth_service.service import identify_token, login, register

router = APIRouter(prefix="/auth", tags=["authentication"])
bearer = HTTPBearer(auto_error=True)
SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
    session: SessionDep,
    request: Request,
) -> User:
    return await identify_token(credentials.credentials, session, request.app.state.redis)


@router.post("/register", response_model=TokenView, status_code=201)
async def create_account(payload: RegisterInput, session: SessionDep, request: Request) -> TokenView:
    return await register(session, request.app.state.redis, payload)


@router.post("/login", response_model=TokenView)
async def create_session(payload: LoginInput, session: SessionDep, request: Request) -> TokenView:
    return await login(session, request.app.state.redis, payload)


@router.get("/me", response_model=UserView)
async def get_current_user(user: Annotated[User, Depends(current_user)]) -> UserView:
    return UserView(id=str(user.id), email=user.email, role=user.role)
