from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    email: str
    role: Optional[str] = "school_admin"
    is_active: Optional[bool] = True

class UserCreate(UserBase):
    school_id: UUID
    password: str  # Plain text password that will be hashed before saving to DB

class UserOut(UserBase):
    id: UUID
    school_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
