from datetime import date

from pydantic import BaseModel, Field


class RoomCreateRequest(BaseModel):
    room_number: str = Field(min_length=1, max_length=30)
    capacity: int = Field(ge=1)
    daily_rent: float = Field(gt=0)


class RoomUpdateRequest(BaseModel):
    room_number: str = Field(min_length=1, max_length=30)
    capacity: int = Field(ge=1)
    daily_rent: float = Field(gt=0)


class RoomResponse(BaseModel):
    id: int
    room_number: str
    capacity: int
    daily_rent: float
    active_residents: int


class RoomOccupantItem(BaseModel):
    resident_id: int
    full_name: str
    check_in_date: date
