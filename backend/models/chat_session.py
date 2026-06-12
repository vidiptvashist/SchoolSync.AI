import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from database import Base

class ChatSession(Base):
    """
    SQLAlchemy model representing the 'chat_sessions' table.
    Tracks parent chat widget sessions with OTP-based authentication.
    """
    __tablename__ = "chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    school_id = Column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False
    )

    parent_phone = Column(String, nullable=False)

    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("students.id", ondelete="SET NULL"),
        nullable=True
    )

    status = Column(String, server_default=text("'active'"), default="active")
    summary = Column(String, nullable=True)
    message_count = Column(Integer, default=0, server_default=text("0"))
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)
