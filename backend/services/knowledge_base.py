"""
Knowledge Base Service — Qdrant-backed document ingestion and semantic search.

Handles:
  - PDF/DOCX text extraction
  - Chunking with overlap
  - Gemini embeddings
  - Qdrant vector storage with school_id filtering
  - Semantic search for RAG queries
"""

import io
import logging
import uuid
from typing import List

import google.generativeai as genai
from pypdf import PdfReader
from docx import Document as DocxDocument
from qdrant_client import QdrantClient
from qdrant_client.http.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PayloadSchemaType,
    PointStruct,
    VectorParams,
)

from settings import QDRANT_URL, QDRANT_API_KEY, GEMINI_API_KEY

logger = logging.getLogger("knowledge_base")

COLLECTION_NAME = "school_knowledge"
EMBEDDING_MODEL = "models/gemini-embedding-2"
VECTOR_SIZE = 768  # Keep Qdrant collection dimensions stable.


class KnowledgeBaseService:
    """Service for ingesting documents and searching the knowledge base."""

    def __init__(self):
        self._client = QdrantClient(
            url=QDRANT_URL,
            api_key=QDRANT_API_KEY,
            timeout=10,
        )
        genai.configure(api_key=GEMINI_API_KEY)

    def _ensure_collection(self) -> None:
        """Create the Qdrant collection if it doesn't already exist."""
        try:
            collections = self._client.get_collections().collections
            names = [c.name for c in collections]
            if COLLECTION_NAME not in names:
                self._client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=VectorParams(
                        size=VECTOR_SIZE,
                        distance=Distance.COSINE,
                    ),
                )
                logger.info(f"Created Qdrant collection: {COLLECTION_NAME}")
            else:
                logger.info(f"Qdrant collection '{COLLECTION_NAME}' already exists")

            self._ensure_payload_indexes()
        except Exception as e:
            logger.error(f"Failed to ensure Qdrant collection: {e}")

    def _ensure_payload_indexes(self) -> None:
        """Ensure payload indexes required for tenant-safe filtering exist."""
        for field_name in ("school_id", "doc_id"):
            try:
                self._client.create_payload_index(
                    collection_name=COLLECTION_NAME,
                    field_name=field_name,
                    field_schema=PayloadSchemaType.KEYWORD,
                    wait=True,
                )
                logger.info(
                    f"Ensured Qdrant payload index on {COLLECTION_NAME}.{field_name}"
                )
            except Exception as e:
                message = str(e).lower()
                if "already exists" in message:
                    logger.info(
                        f"Qdrant payload index already exists on {COLLECTION_NAME}.{field_name}"
                    )
                    continue
                raise

    # ─────────────── Text Extraction ───────────────

    @staticmethod
    def _extract_text_pdf(file_bytes: bytes) -> str:
        """Extract all text from a PDF file."""
        reader = PdfReader(io.BytesIO(file_bytes))
        pages = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
        return "\n\n".join(pages)

    @staticmethod
    def _extract_text_docx(file_bytes: bytes) -> str:
        """Extract all text from a DOCX file."""
        doc = DocxDocument(io.BytesIO(file_bytes))
        paragraphs = []
        for para in doc.paragraphs:
            text = para.text.strip()
            if text:
                paragraphs.append(text)
        return "\n\n".join(paragraphs)

    @staticmethod
    def _extract_text_csv(file_bytes: bytes) -> str:
        """Extract text from a CSV file using pandas."""
        import pandas as pd
        df = pd.read_csv(io.BytesIO(file_bytes))
        return df.to_csv(index=False)

    @staticmethod
    def _extract_text_excel(file_bytes: bytes) -> str:
        """Extract text from an Excel file (.xlsx or .xls) using pandas."""
        import pandas as pd
        # Read all sheets and concatenate their contents
        try:
            excel_file = pd.ExcelFile(io.BytesIO(file_bytes))
            sheets_text = []
            for sheet_name in excel_file.sheet_names:
                df = pd.read_excel(excel_file, sheet_name=sheet_name)
                sheets_text.append(f"Sheet: {sheet_name}\n" + df.to_csv(index=False))
            return "\n\n".join(sheets_text)
        except Exception:
            df = pd.read_excel(io.BytesIO(file_bytes))
            return df.to_csv(index=False)

    @staticmethod
    def _extract_text_plain(file_bytes: bytes) -> str:
        """Extract text from plain text formats with encoding fallback."""
        try:
            return file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                return file_bytes.decode("latin-1")
            except Exception as e:
                raise ValueError(f"Failed to decode text file: {e}")

    # ─────────────── Chunking ───────────────

    @staticmethod
    def _chunk_text(text: str, chunk_size: int = 400, overlap: int = 50) -> List[str]:
        """
        Split text into chunks of ~chunk_size words with overlap.
        Returns list of chunk strings.
        """
        words = text.split()
        if not words:
            return []

        chunks = []
        start = 0
        while start < len(words):
            end = start + chunk_size
            chunk = " ".join(words[start:end])
            chunks.append(chunk)
            start = end - overlap  # slide with overlap

        return chunks

    # ─────────────── Embeddings ───────────────

    @staticmethod
    def _embed_texts(texts: List[str]) -> List[List[float]]:
        """Generate document embeddings using Gemini."""
        if not texts:
            return []

        result = genai.embed_content(
            model=EMBEDDING_MODEL,
            content=[f"title: none | text: {text}" for text in texts],
            output_dimensionality=VECTOR_SIZE,
        )
        return result["embedding"]

    @staticmethod
    def _embed_query(query: str) -> List[float]:
        """Generate a query embedding using Gemini."""
        result = genai.embed_content(
            model=EMBEDDING_MODEL,
            content=f"task: search result | query: {query}",
            output_dimensionality=VECTOR_SIZE,
        )
        return result["embedding"]

    # ─────────────── Public API ───────────────

    async def ingest_document(
        self,
        file_bytes: bytes,
        filename: str,
        school_id: str,
        doc_id: str,
    ) -> int:
        """
        Ingest a document of any supported format into the Qdrant knowledge base.

        1. Extract text from the file (PDF, DOCX, CSV, Excel, TXT, MD, etc.)
        2. Split into ~400-word chunks with 50-word overlap
        3. Generate embeddings with Gemini
        4. Store in Qdrant with school_id + doc_id payload

        Returns: number of chunks stored
        """
        self._ensure_collection()
        # Determine file type and extract text
        lower = filename.lower()
        if lower.endswith(".pdf"):
            text = self._extract_text_pdf(file_bytes)
        elif lower.endswith(".docx"):
            text = self._extract_text_docx(file_bytes)
        elif lower.endswith(".csv"):
            text = self._extract_text_csv(file_bytes)
        elif lower.endswith((".xlsx", ".xls")):
            text = self._extract_text_excel(file_bytes)
        else:
            # Fallback text decoding for txt, md, json, html, rtf, etc.
            text = self._extract_text_plain(file_bytes)

        if not text.strip():
            raise ValueError("No text could be extracted from the document")

        logger.info(
            f"Extracted {len(text)} chars from {filename} for school {school_id}"
        )

        # Chunk text
        chunks = self._chunk_text(text, chunk_size=400, overlap=50)
        if not chunks:
            raise ValueError("Text chunking produced no chunks")

        logger.info(f"Created {len(chunks)} chunks from {filename}")

        # Generate embeddings (batch)
        embeddings = self._embed_texts(chunks)

        # Build Qdrant points
        points = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            point_id = str(uuid.uuid4())
            points.append(
                PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload={
                        "school_id": school_id,
                        "doc_id": doc_id,
                        "filename": filename,
                        "chunk_index": i,
                        "text": chunk,
                    },
                )
            )

        # Upsert to Qdrant in batches of 100
        batch_size = 100
        for i in range(0, len(points), batch_size):
            batch = points[i : i + batch_size]
            self._client.upsert(
                collection_name=COLLECTION_NAME,
                points=batch,
            )

        logger.info(
            f"Stored {len(points)} vectors in Qdrant for doc {doc_id}"
        )
        return len(points)

    async def search(
        self, query: str, school_id: str, top_k: int = 3
    ) -> List[str]:
        """
        Semantic search the knowledge base for a school.

        1. Embed the query with Gemini
        2. Search Qdrant filtered by school_id
        3. Return top_k chunk texts
        """
        import asyncio
        def _do_search():
            try:
                query_embedding = self._embed_query(query)

                results = self._client.query_points(
                    collection_name=COLLECTION_NAME,
                    query=query_embedding,
                    query_filter=Filter(
                        must=[
                            FieldCondition(
                                key="school_id",
                                match=MatchValue(value=school_id),
                            )
                        ]
                    ),
                    limit=top_k,
                )

                return [hit.payload["text"] for hit in results.points if hit.payload]
            except Exception as e:
                logger.error(f"Qdrant search failed: {e}")
                return []
            
        return await asyncio.to_thread(_do_search)

    async def delete_document(self, doc_id: str, school_id: str) -> None:
        """
        Delete all vector chunks for a specific document.
        Filters by both doc_id and school_id for safety.
        """
        self._client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="doc_id",
                        match=MatchValue(value=doc_id),
                    ),
                    FieldCondition(
                        key="school_id",
                        match=MatchValue(value=school_id),
                    ),
                ]
            ),
        )
        logger.info(
            f"Deleted vectors for doc {doc_id} (school {school_id})"
        )
