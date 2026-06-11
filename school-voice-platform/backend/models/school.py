import uuid
from sqlalchemy import Column, String, DateTime, Boolean, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from database import Base

class School(Base):
    """
    SQLAlchemy model representing the 'schools' table.
    Contains core details for each tenant school on the platform.
    """
    __tablename__ = "schools"
    
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(), # Generate UUID in DB
        default=uuid.uuid4                     # Fallback local generation
    )
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    city = Column(String, nullable=True)
    exotel_number = Column(String, nullable=True)  # Dediciated phone number for incoming calls
    is_active = Column(Boolean, server_default=text("true"), default=True, nullable=False)
    primary_color = Column(String, server_default=text("'#1e40af'"), default="#1e40af", nullable=True)
    logo_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
