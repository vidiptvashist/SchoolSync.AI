import uuid
from sqlalchemy import Column, String, Date, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID
from database import Base

class FeeRecord(Base):
    __tablename__ = "fee_records"
    
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
    
    amount_due = Column(Float, nullable=False)
    amount_paid = Column(Float, nullable=False)
    due_date = Column(Date, nullable=False)
    status = Column(String, nullable=False)  # paid, partial, pending, overdue
    description = Column(String, nullable=True)  # e.g. "Term 2 Fee"
