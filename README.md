# VeriRAG — Evaluated Document & Policy Assistant

An end-to-end Retrieval-Augmented Generation (RAG) system featuring **Hybrid Search (Dense Vector + PostgreSQL Full-Text Search with Reciprocal Rank Fusion)**, **Deterministic Structured Citations**, and an automated **Natural Language Inference (NLI) Faithfulness Judge**.

## System Architecture

```text
[Next.js Frontend (Vercel)]
        │  REST / JSON
        ▼
[FastAPI Backend (Render)] ──────► [Google Gemini API]
        │                           ├─ gemini-embedding-001 (768-dim L2-normalized)
        │                           └─ gemini-3.5-flash-lite / 3.8-flash (Fallback Chain)
        ▼
[Supabase PostgreSQL + pgvector]
        ├─ HNSW Cosine Index (<=>)
        ├─ GIN Full-Text Index (tsvector / ts_rank_cd)
        └─ SQL Reciprocal Rank Fusion (RRF) RPC