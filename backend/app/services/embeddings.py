import math
from typing import List
from google import genai
from google.genai import types
from app.core.config import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)
EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 768


def _l2_normalize(vec: List[float]) -> List[float]:
    norm = math.sqrt(sum(x * x for x in vec))
    if norm == 0:
        return vec
    return [x / norm for x in vec]


def embed_documents(texts: List[str], batch_size: int = 50) -> List[List[float]]:
    all_embeddings: List[List[float]] = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        response = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=batch,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_DOCUMENT",
                output_dimensionality=EMBEDDING_DIM,
            ),
        )
        for emb in response.embeddings:
            all_embeddings.append(_l2_normalize(list(emb.values)))

    return all_embeddings


def embed_query(query: str) -> List[float]:
    response = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=query,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY",
            output_dimensionality=EMBEDDING_DIM,
        ),
    )
    return _l2_normalize(list(response.embeddings[0].values))