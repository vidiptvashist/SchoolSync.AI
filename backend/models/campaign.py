import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.sql import func
from database import Base

class Campaign(Base):
    """
    SQLAlchemy model representing the 'campaigns' table.
    Tracks calling campaigns initiated to broadcast a specific notice.
    """
    __tablename__ = "campaigns"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign key linking back to schools table (Crucial Multi-tenant key)
    school_id = Column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # Foreign key linking to notice table
    notice_id = Column(
        UUID(as_uuid=True),
        ForeignKey("notices.id", ondelete="CASCADE"),
        nullable=False
    )
    
    name = Column(String, nullable=True)
    
    # Target filters: all, class, section, custom
    target_type = Column(String, default="all", nullable=False)
    
    # Target configurations (e.g. {"class_name": "8", "section": "A"})
    target_filter = Column(JSON, nullable=True)
    
    # Campaign run states: pending, running, completed, failed
    status = Column(String, default="pending", nullable=False)
    
    # Progress metrics
    total_calls = Column(Integer, default=0, nullable=False)
    answered_calls = Column(Integer, default=0, nullable=False)
    
    # Time logs
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
