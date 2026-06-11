import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from database import Base

class Student(Base):
    """
    SQLAlchemy model representing the 'students' table.
    Contains basic student metadata and parental contact numbers for call dispatches.
    """
    __tablename__ = "students"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign key linking back to schools table (Crucial Multi-tenant key)
    school_id = Column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False
    )
    
    name = Column(String, nullable=False)
    class_name = Column(String, nullable=True)
    section = Column(String, nullable=True)
    roll_number = Column(String, nullable=True)
    parent_name = Column(String, nullable=True)
    parent_phone = Column(String, nullable=False) # Destination phone number for voice AI calls
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
