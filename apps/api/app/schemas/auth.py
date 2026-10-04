from enum import StrEnum

from pydantic import BaseModel, EmailStr, Field


class Role(StrEnum):
    PATIENT = "patient"
    PROVIDER = "provider"
    CAREGIVER = "caregiver"


class RegisterInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    role: Role


class LoginInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserView(BaseModel):
    id: str
    email: EmailStr
    role: Role


class TokenView(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserView
