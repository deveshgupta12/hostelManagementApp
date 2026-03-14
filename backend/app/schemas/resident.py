from datetime import date

from pydantic import BaseModel


class ResidentDirectoryItem(BaseModel):
    resident_id: int
    full_name: str
    room_number: str
    check_in_date: date
