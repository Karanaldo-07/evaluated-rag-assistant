from uuid import UUID
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel, Field
from app.core.database import get_db_conn
from app.services.pdf_processor import extract_and_chunk_pdf
from app.services.embeddings import embed_documents, embed_query
from app.services.rag_engine import run_evaluated_rag

router = APIRouter(prefix="/api/v1", tags=["RAG Pipeline"])


class SearchRequest(BaseModel):
    document_id: UUID
    query: str
    top_k: int = 5


class ChatQueryRequest(BaseModel):
    document_id: UUID
    query: str = Field(..., min_length=2, max_length=1000)
    top_k: int = Field(default=5, ge=1, le=10)


@router.post("/documents/upload")
async def upload_document(file: UploadFile = File(...), is_demo: bool = False):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()
    if len(file_bytes) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF must be under 15 MB.")

    parsed = extract_and_chunk_pdf(file_bytes)
    chunks = parsed["chunks"]
    if not chunks:
        raise HTTPException(
            status_code=400,
            detail="No selectable text found in PDF (scanned image-only PDFs are not supported).",
        )

    texts = [c["content"] for c in chunks]
    vectors = embed_documents(texts)

    with get_db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO documents (title, page_count, is_demo)
                VALUES (%s, %s, %s)
                RETURNING id, title, page_count, is_demo, created_at;
                """,
                (file.filename, parsed["page_count"], is_demo),
            )
            doc_row = cur.fetchone()
            doc_id = doc_row[0]

            rows_to_insert = [
                (
                    doc_id,
                    chunk["page_number"],
                    chunk["chunk_index"],
                    chunk["content"],
                    vec,
                )
                for chunk, vec in zip(chunks, vectors)
            ]

            cur.executemany(
                """
                INSERT INTO document_chunks (document_id, page_number, chunk_index, content, embedding)
                VALUES (%s, %s, %s, %s, %s::vector);
                """,
                rows_to_insert,
            )
        conn.commit()

    return {
        "document_id": str(doc_id),
        "title": doc_row[1],
        "page_count": doc_row[2],
        "chunks_indexed": len(chunks),
        "is_demo": doc_row[3],
    }


@router.get("/documents")
def list_documents():
    with get_db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, title, page_count, is_demo, created_at
                FROM documents
                ORDER BY is_demo DESC, created_at DESC;
                """
            )
            rows = cur.fetchall()

    return [
        {
            "id": str(r[0]),
            "title": r[1],
            "page_count": r[2],
            "is_demo": r[3],
            "created_at": r[4].isoformat(),
        }
        for r in rows
    ]


@router.delete("/documents/{document_id}")
def delete_document(document_id: UUID):
    with get_db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM documents WHERE id = %s RETURNING id;", (str(document_id),))
            deleted = cur.fetchone()
        conn.commit()

    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found.")
    return {"deleted_id": str(deleted[0])}


@router.post("/search/test")
def test_hybrid_search(payload: SearchRequest):
    query_vec = embed_query(payload.query)

    with get_db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, page_number, chunk_index, content, rrf_score
                FROM hybrid_search_chunks(%s, %s, %s::vector, %s);
                """,
                (str(payload.document_id), payload.query, query_vec, payload.top_k),
            )
            results = cur.fetchall()

    return {
        "query": payload.query,
        "matches": [
            {
                "chunk_id": str(r[0]),
                "page_number": r[1],
                "chunk_index": r[2],
                "rrf_score": round(r[4], 5),
                "content": r[3],
            }
            for r in results
        ],
    }


@router.post("/chat/query")
def chat_with_document(payload: ChatQueryRequest):
    try:
        return run_evaluated_rag(
            document_id=str(payload.document_id),
            query=payload.query,
            top_k=payload.top_k,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG pipeline failed: {str(e)}")