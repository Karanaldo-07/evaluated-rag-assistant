const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export interface DocumentItem {
  id: string;
  title: string;
  page_count: number;
  is_demo: boolean;
  created_at: string;
}

export interface CitationRef {
  chunk_index: number;
  page_number: number;
  quote: string;
}

export interface RetrievedChunk {
  chunk_id: string;
  page_number: number;
  chunk_index: number;
  content: string;
  rrf_score: number;
}

export interface RagQueryResponse {
  answer: string;
  is_answerable: boolean;
  citations: CitationRef[];
  retrieved_chunks: RetrievedChunk[];
  evaluation: {
    faithfulness_score: number;
    supported_claims: number;
    total_claims: number;
    verdict: string;
  };
  metrics: {
    model_used: string;
    retrieval_ms: number;
    generation_ms: number;
    evaluation_ms: number;
    total_ms: number;
  };
}

export async function fetchDocuments(): Promise<DocumentItem[]> {
  const res = await fetch(`${API_BASE}/api/v1/documents`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load documents");
  return res.json();
}

export async function uploadPdfDocument(file: File, isDemo: boolean = false) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/v1/documents/upload?is_demo=${isDemo}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

export async function deleteDocumentById(documentId: string) {
  const res = await fetch(`${API_BASE}/api/v1/documents/${documentId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete document");
  return res.json();
}

export async function queryDocumentRag(
  documentId: string,
  query: string,
  topK: number = 5
): Promise<RagQueryResponse> {
  const res = await fetch(`${API_BASE}/api/v1/chat/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document_id: documentId, query, top_k: topK }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Query failed" }));
    throw new Error(err.detail || "Query failed");
  }
  return res.json();
}