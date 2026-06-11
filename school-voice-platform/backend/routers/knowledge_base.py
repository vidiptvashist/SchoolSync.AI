"""
Knowledge Base Router — Upload, list, search, and delete school documents.

POST   /knowledge-base/upload      → Upload PDF/DOCX, trigger ingestion
GET    /knowledge-base/             → List all documents for school
GET    /knowledge-base/search       → Semantic search
DELETE /knowledge-base/{doc_id}     → Delete document and vectors
"""

import logging
import uuid
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, UploadFile, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db, SessionLocal
from models.knowledge_document import KnowledgeDocument
from models.user import User
from services.knowledge_base import KnowledgeBaseService
from core.dependencies import get_current_user

logger = logging.getLogger("knowledge_base_router")
router = APIRouter(prefix="/knowledge-base", tags=["Knowledge Base"])

# Singleton service instance
_kb_service: Optional[KnowledgeBaseService] = None


def get_kb_service() -> KnowledgeBaseService:
    global _kb_service
    if _kb_service is None:
        _kb_service = KnowledgeBaseService()
    return _kb_service


# ─────────────── Background ingestion task ───────────────

async def _ingest_document_task(
    file_bytes: bytes,
    filename: str,
    school_id: str,
    doc_id: str,
):
    """Background task to ingest a document into Qdrant and update status."""
    kb = get_kb_service()

    try:
        chunk_count = await kb.ingest_document(
            file_bytes=file_bytes,
            filename=filename,
            school_id=school_id,
            doc_id=doc_id,
        )

        # Update the document record in DB
        async with SessionLocal() as db:
            result = await db.execute(
                select(KnowledgeDocument).filter(
                    KnowledgeDocument.id == uuid.UUID(doc_id)
                )
            )
            doc = result.scalars().first()
            if doc:
                doc.status = "ready"
                doc.chunk_count = chunk_count
                await db.commit()
                logger.info(
                    f"Document {doc_id} ingested: {chunk_count} chunks"
                )

    except Exception as e:
        logger.error(f"Ingestion failed for {doc_id}: {e}", exc_info=True)
        async with SessionLocal() as db:
            result = await db.execute(
                select(KnowledgeDocument).filter(
                    KnowledgeDocument.id == uuid.UUID(doc_id)
                )
            )
            doc = result.scalars().first()
            if doc:
                doc.status = "failed"
                await db.commit()


# ─────────────── Endpoints ───────────────


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a PDF or DOCX file for knowledge base ingestion.
    The file is read and ingestion runs as a background task.
    """
    school_id = current_user.school_id

    # Validate file type
    filename = file.filename or "document"
    lower = filename.lower()
    if not (lower.endswith(".pdf") or lower.endswith(".docx")):
        return JSONResponse(
            status_code=400,
            content={"detail": "Only PDF and DOCX files are supported"},
        )

    # Read file bytes
    file_bytes = await file.read()
    file_size = len(file_bytes)
    file_type = "pdf" if lower.endswith(".pdf") else "docx"

    # Create DB record
    doc_id = uuid.uuid4()
    async with SessionLocal() as db:
        doc = KnowledgeDocument(
            id=doc_id,
            school_id=school_id,
            filename=filename,
            file_type=file_type,
            file_size=file_size,
            chunk_count=0,
            status="processing",
        )
        db.add(doc)
        await db.commit()
        await db.refresh(doc)

    logger.info(f"Document {doc_id} uploaded: {filename} ({file_size} bytes)")

    # Schedule background ingestion
    background_tasks.add_task(
        _ingest_document_task,
        file_bytes,
        filename,
        str(school_id),
        str(doc_id),
    )

    return {
        "id": str(doc_id),
        "filename": filename,
        "file_type": file_type,
        "file_size": file_size,
        "status": "processing",
        "message": "Document uploaded. Ingestion is running in the background.",
    }


@router.get("/")
async def list_documents(
    current_user: User = Depends(get_current_user),
):
    """List all knowledge base documents for the current school."""
    school_id = current_user.school_id

    async with SessionLocal() as db:
        result = await db.execute(
            select(KnowledgeDocument)
            .filter(KnowledgeDocument.school_id == school_id)
            .order_by(KnowledgeDocument.created_at.desc())
        )
        docs = result.scalars().all()

    return [
        {
            "id": str(d.id),
            "filename": d.filename,
            "file_type": d.file_type,
            "file_size": d.file_size,
            "chunk_count": d.chunk_count,
            "status": d.status,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]


@router.get("/search")
async def search_knowledge_base(
    q: str = Query(..., min_length=2, description="Search query"),
    top_k: int = Query(3, ge=1, le=10),
    current_user: User = Depends(get_current_user),
):
    """Semantic search the knowledge base for the current school."""
    school_id = str(current_user.school_id)

    kb = get_kb_service()
    results = await kb.search(query=q, school_id=school_id, top_k=top_k)

    return {"query": q, "results": results, "count": len(results)}


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a document and all its vectors from the knowledge base."""
    school_id = current_user.school_id

    # Delete from Qdrant
    try:
        kb = get_kb_service()
        await kb.delete_document(doc_id=doc_id, school_id=str(school_id))
    except Exception as e:
        logger.error(f"Failed to delete vectors for {doc_id}: {e}")

    # Delete from DB
    async with SessionLocal() as db:
        result = await db.execute(
            select(KnowledgeDocument).filter(
                KnowledgeDocument.id == uuid.UUID(doc_id),
                KnowledgeDocument.school_id == school_id,
            )
        )
        doc = result.scalars().first()
        if doc:
            await db.delete(doc)
            await db.commit()
            logger.info(f"Document {doc_id} deleted from DB and Qdrant")
            return {"message": "Document deleted successfully", "id": doc_id}

    return JSONResponse(
        status_code=404,
        content={"detail": "Document not found"},
    )
