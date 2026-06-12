import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from database import Base

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign key linking back to schools table (Crucial Multi-tenant key)
    school_id = Column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # Foreign key linking back to students table
    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False
    )
    
    month = Column(String, nullable=False)  # e.g., "2026-06"
    total_days = Column(Integer, nullable=False)
    present_days = Column(Integer, nullable=False)
    attendance_percentage = Column(Float, nullable=False)
    
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
