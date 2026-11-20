import random
import time
from typing import List, Dict, Any, Type
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from app.core.config import settings
from app.core.database import get_db_conn
from app.services.embeddings import embed_query

client = genai.Client(api_key=settings.GEMINI_API_KEY)

# Primary model + fallbacks in case of transient 503 capacity spikes
FALLBACK_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
]


# --- Pydantic Schemas for Deterministic Structured Outputs ---
class CitationRef(BaseModel):
    chunk_index: int = Field(description="The chunk_index of the source chunk used.")
    page_number: int = Field(description="The page number of the source chunk.")
    quote: str = Field(description="Exact short verbatim phrase (5-15 words) from the chunk backing the claim.")


class GeneratedAnswerSchema(BaseModel):
    answer: str = Field(
        description="Clear, well-structured answer grounded strictly in the provided context, with inline [Page X] citations."
    )
    is_answerable: bool = Field(
        description="True if the provided context contains enough information to answer the question; False otherwise."
    )
    citations: List[CitationRef] = Field(
        description="List of specific source citations supporting the answer."
    )


class FaithfulnessEvalSchema(BaseModel):
    total_claims: int = Field(description="Total number of distinct factual statements made in the answer.")
    supported_claims: int = Field(description="Number of statements strictly supported by the retrieved context.")
    faithfulness_score: float = Field(
        description="Ratio of supported_claims to total_claims between 0.0 and 1.0. If answer states info is missing, return 1.0."
    )
    verdict: str = Field(
        description="Short 1-sentence audit note explaining whether any unsupported details or extrapolations were detected."
    )


def _call_with_resilience(
    contents: str,
    system_instruction: str,
    response_schema: Type[BaseModel],
    temperature: float = 0.1,
) -> tuple[Any, str]:
    """Retries transient 503/429 errors with exponential backoff and falls back across Gemini models."""
    last_error = None

    for model_name in FALLBACK_MODELS:
        for attempt in range(2):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=temperature,
                        response_mime_type="application/json",
                        response_schema=response_schema,
                        thinking_config=types.ThinkingConfig(thinking_budget=0),
                    ),
                )
                return response.parsed, model_name
            except Exception as e:
                last_error = e
                err_str = str(e)
                is_transient = any(code in err_str for code in ["503", "429", "UNAVAILABLE", "overloaded"])
                if is_transient:
                    # Short exponential backoff with jitter before retrying or switching model
                    sleep_time = (2 ** attempt) * 0.8 + random.uniform(0.1, 0.5)
                    time.sleep(sleep_time)
                    continue
                # If it's a 404 (model name not supported on this key), skip immediately to next fallback model
                if "404" in err_str or "NOT_FOUND" in err_str:
                    break
                raise e

    raise RuntimeError(f"All Gemini fallback models temporarily unavailable. Last error: {last_error}")


def retrieve_hybrid_chunks(document_id: str, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    query_vec = embed_query(query)
    with get_db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, page_number, chunk_index, content, rrf_score
                FROM hybrid_search_chunks(%s, %s, %s::vector, %s);
                """,
                (document_id, query, query_vec, top_k),
            )
            rows = cur.fetchall()

    return [
        {
            "chunk_id": str(r[0]),
            "page_number": r[1],
            "chunk_index": r[2],
            "content": r[3],
            "rrf_score": round(r[4], 5),
        }
        for r in rows
    ]


def generate_grounded_answer(query: str, chunks: List[Dict[str, Any]]) -> tuple[GeneratedAnswerSchema, str]:
    formatted_context = "\n\n".join(
        [
            f"[Chunk Index: {c['chunk_index']} | Page: {c['page_number']}]\n{c['content']}"
            for c in chunks
        ]
    )

    system_instruction = (
        "You are a strict, evidence-based document assistant. "
        "Answer the user's question using ONLY the provided document chunks. "
        "Do NOT use outside knowledge or assume facts not explicitly written in the context. "
        "Include inline page citations like [Page 2] after claims. "
        "If the context does not contain the answer, set is_answerable=False and state clearly what is missing."
    )

    prompt = f"CONTEXT:\n{formatted_context}\n\nUSER QUESTION:\n{query}"

    return _call_with_resilience(
        contents=prompt,
        system_instruction=system_instruction,
        response_schema=GeneratedAnswerSchema,
        temperature=0.1,
    )


def evaluate_faithfulness(answer: str, chunks: List[Dict[str, Any]]) -> tuple[FaithfulnessEvalSchema, str]:
    formatted_context = "\n\n".join(
        [f"[Page {c['page_number']}] {c['content']}" for c in chunks]
    )

    judge_instruction = (
        "You are an automated RAG Faithfulness Auditor (Natural Language Inference judge). "
        "Compare the GENERATED ANSWER against the SOURCE CONTEXT. "
        "Break the answer into individual factual claims and verify whether each claim is directly entailed by the source context. "
        "Penalize any hallucinated numbers, outside facts, or unsupported extrapolations. "
        "If the answer truthfully states that the document does not mention the requested information, score it 1.0."
    )

    prompt = f"SOURCE CONTEXT:\n{formatted_context}\n\nGENERATED ANSWER:\n{answer}"

    return _call_with_resilience(
        contents=prompt,
        system_instruction=judge_instruction,
        response_schema=FaithfulnessEvalSchema,
        temperature=0.0,
    )


def run_evaluated_rag(document_id: str, query: str, top_k: int = 5) -> Dict[str, Any]:
    t0 = time.perf_counter()

    # 1. Hybrid Retrieval (Vector + Full-Text RRF)
    chunks = retrieve_hybrid_chunks(document_id=document_id, query=query, top_k=top_k)
    t_retrieval = time.perf_counter()

    if not chunks:
        return {
            "answer": "No relevant text sections were found in this document for your query.",
            "is_answerable": False,
            "citations": [],
            "retrieved_chunks": [],
            "evaluation": {
                "faithfulness_score": 1.0,
                "supported_claims": 0,
                "total_claims": 0,
                "verdict": "No chunks retrieved; safe refusal returned.",
            },
            "metrics": {
                "model_used": "none",
                "retrieval_ms": round((t_retrieval - t0) * 1000, 1),
                "generation_ms": 0.0,
                "evaluation_ms": 0.0,
                "total_ms": round((t_retrieval - t0) * 1000, 1),
            },
        }

    # 2. Grounded Answer Generation
    gen_result, gen_model = generate_grounded_answer(query=query, chunks=chunks)
    t_generation = time.perf_counter()

    # 3. Faithfulness Verification Judge
    eval_result, eval_model = evaluate_faithfulness(answer=gen_result.answer, chunks=chunks)
    t_eval = time.perf_counter()

    safe_score = max(0.0, min(1.0, round(eval_result.faithfulness_score, 2)))

    return {
        "answer": gen_result.answer,
        "is_answerable": gen_result.is_answerable,
        "citations": [c.model_dump() for c in gen_result.citations],
        "retrieved_chunks": chunks,
        "evaluation": {
            "faithfulness_score": safe_score,
            "supported_claims": eval_result.supported_claims,
            "total_claims": eval_result.total_claims,
            "verdict": eval_result.verdict,
        },
        "metrics": {
            "model_used": f"gen:{gen_model} | eval:{eval_model}",
            "retrieval_ms": round((t_retrieval - t0) * 1000, 1),
            "generation_ms": round((t_generation - t_retrieval) * 1000, 1),
            "evaluation_ms": round((t_eval - t_generation) * 1000, 1),
            "total_ms": round((t_eval - t0) * 1000, 1),
        },
    }