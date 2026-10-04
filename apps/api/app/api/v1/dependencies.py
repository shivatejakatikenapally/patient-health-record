from typing import Annotated

from fastapi import Depends, HTTPException

from app.api.v1.routes_auth import current_user
from app.models.user import User, UserRole


def role_user(required: UserRole):
    async def dependency(user: Annotated[User, Depends(current_user)]) -> User:
        if user.role != required.value:
            raise HTTPException(status_code=403, detail="This action is not available for this account type")
        return user

    return dependency


PatientUser = Annotated[User, Depends(role_user(UserRole.PATIENT))]
ProviderUser = Annotated[User, Depends(role_user(UserRole.PROVIDER))]
