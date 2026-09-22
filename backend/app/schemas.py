import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str | None = Field(default=None, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    id_token: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str | None
    height_cm: float | None
    ape_index_cm: float | None
    weight_kg: float | None
    dominant_hand: str | None
    current_grade: str | None
    injuries_notes: str | None
    created_at: datetime.datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class ProfileUpdateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    height_cm: float | None = Field(default=None, gt=0, lt=300)
    ape_index_cm: float | None = Field(default=None, gt=-50, lt=50)
    weight_kg: float | None = Field(default=None, gt=0, lt=400)
    dominant_hand: str | None = Field(default=None, pattern="^(left|right|ambidextrous)$")
    current_grade: str | None = Field(default=None, max_length=20)
    injuries_notes: str | None = Field(default=None, max_length=1000)
