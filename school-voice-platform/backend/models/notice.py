import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from database import Base

class Notice(Base):
    """
    SQLAlchemy model representing the 'notices' table.
    Stores school notices, text message to be synthesized into speech, and audio status.
    """
    __tablename__ = "notices"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign key linking back to schools table (Crucial Multi-tenant key)
    school_id = Column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False
    )
    
    title = Column(String, nullable=False)
    message = Column(String, nullable=False) # The actual text to be spoken / synthesized
    
    # Notice types: holiday, ptm, emergency, fee, general
    type = Column(String, default="general", nullable=False)
    
    # S3 audio file configurations
    audio_url = Column(String, nullable=True) # S3 URL of generated speech audio
    
    # Audio synthesis progress state: pending, generating, ready, failed
    audio_status = Column(String, default="pending", nullable=False)
    
    # Tracking creator user id
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
