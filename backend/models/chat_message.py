import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from database import Base

class ChatMessage(Base):
    """
    SQLAlchemy model representing the 'chat_messages' table.
    Stores individual messages in a chat session (user and assistant turns).
    """
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    school_id = Column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False
    )

    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False
    )

    role = Column(String, nullable=False)  # 'user' or 'assistant'
    content = Column(String, nullable=False)
    intent = Column(String, nullable=True)  # fee_query, attendance_query, general_faq, etc.

    created_at = Column(DateTime(timezone=True), server_default=func.now())
