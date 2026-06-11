import uuid
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from database import Base


class KnowledgeDocument(Base):
    """
    SQLAlchemy model representing the 'knowledge_documents' table.
    Tracks uploaded PDFs/DOCXs that have been ingested into Qdrant.
    """
    __tablename__ = "knowledge_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    school_id = Column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False,
    )

    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # "pdf" or "docx"
    file_size = Column(Integer, default=0)       # bytes
    chunk_count = Column(Integer, default=0)     # number of vector chunks stored
    status = Column(String, default="processing")  # processing, ready, failed

    created_at = Column(DateTime(timezone=True), server_default=func.now())
