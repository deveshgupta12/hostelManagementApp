from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class CurrentUserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: UserRole
    is_active: bool
