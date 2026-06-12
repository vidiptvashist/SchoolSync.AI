import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from database import Base

class CallLog(Base):
    """
    SQLAlchemy model representing the 'call_logs' table.
    Contains detailed execution logs for inbound or outbound voice AI calls.
    """
    __tablename__ = "call_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign key linking back to schools table (Crucial Multi-tenant key)
    school_id = Column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # Optional relation to a broadcast campaign (SET NULL if campaign gets deleted)
    campaign_id = Column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="SET NULL"),
        nullable=True
    )
    
    caller_phone = Column(String, nullable=False)
    
    # Call configurations: inbound, outbound
    direction = Column(String, nullable=False)
    
    # Call states: answered, missed, failed, busy
    status = Column(String, nullable=False)
    
    duration_seconds = Column(Integer, default=0, nullable=False)
    
    # AI classifications & transcripts
    intent = Column(String, nullable=True) # e.g. fee_query, attendance_query, general_faq
    summary = Column(String, nullable=True)
    
    # Integration unique identifier (Exotel call identifier)
    exotel_call_sid = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
