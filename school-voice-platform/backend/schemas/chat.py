from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


# --- School Info (public widget endpoint) ---

class SchoolInfoResponse(BaseModel):
    school_id: UUID
    name: str
    primary_color: str
    logo_url: Optional[str] = None
    greeting: str


# --- OTP Flow ---

class OTPRequestBody(BaseModel):
    phone: str
    school_id: UUID

class OTPRequestResponse(BaseModel):
    message: str
    masked_phone: str

class OTPVerifyBody(BaseModel):
    phone: str
    school_id: UUID
    otp: str

class OTPVerifyResponse(BaseModel):
    chat_token: str
    student_name: str
    class_name: Optional[str] = None


# --- Chat Messages ---

class ChatMessageBody(BaseModel):
    message: str

class ChatMessageResponse(BaseModel):
    reply: str
    intent: Optional[str] = None


# --- Chat Sessions (admin view) ---

class ChatSessionOut(BaseModel):
    id: UUID
    school_id: UUID
    parent_phone: str
    student_name: Optional[str] = None
    class_name: Optional[str] = None
    status: str
    message_count: int
    summary: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None

    class Config:
        from_attributes = True
