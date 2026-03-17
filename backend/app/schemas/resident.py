from datetime import date

from pydantic import BaseModel, EmailStr, Field


class ResidentDirectoryItem(BaseModel):
    resident_id: int
    full_name: str
    room_number: str
    check_in_date: date


class ResidentCreateRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    phone_number: str | None = Field(default=None, min_length=7, max_length=20)
    parent_name: str = Field(min_length=1, max_length=100)
    parent_phone_number: str = Field(min_length=7, max_length=20)
    password: str = Field(min_length=6, max_length=128)
    room_id: int
    monthly_rent: float | None = Field(default=None, gt=0)
    check_in_date: date
    is_long_term_residential: bool = True


class ResidentManagementItem(BaseModel):
    resident_id: int
    full_name: str
    email: EmailStr
    phone_number: str | None
    parent_name: str | None
    parent_phone_number: str | None
    room_id: int
    room_number: str
    monthly_rent: float | None
    due_amount: float
    check_in_date: date
    check_out_date: date | None
    is_long_term_residential: bool


class ResidentUpdateRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    phone_number: str | None = Field(default=None, min_length=7, max_length=20)
    parent_name: str = Field(min_length=1, max_length=100)
    parent_phone_number: str = Field(min_length=7, max_length=20)
    room_id: int
    monthly_rent: float | None = Field(default=None, gt=0)
    check_in_date: date
    check_out_date: date | None = None
    is_long_term_residential: bool = True


class ResidentCheckoutRequest(BaseModel):
    check_out_date: date | None = None
