from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional

class SchoolBase(BaseModel):
    """Base fields shared between creation and retrieval"""
    name: str
    phone: Optional[str] = None

class SchoolCreate(SchoolBase):
    """Schema used when creating a new school"""
    pass

class SchoolUpdate(BaseModel):
    """Schema used to update general school profile fields"""
    name: Optional[str] = None
    city: Optional[str] = None

class SchoolBrandingUpdate(BaseModel):
    """Schema used to update school widget branding color"""
    primary_color: Optional[str] = None

class SchoolProfileOut(SchoolBase):
    """Full school profile details returned to school admins"""
    id: UUID
    city: Optional[str] = None
    primary_color: Optional[str] = None
    logo_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class SchoolOut(SchoolBase):
    """Schema used when sending school data back in API responses"""
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


