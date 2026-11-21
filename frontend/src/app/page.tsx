"use client";

import React, { useEffect, useState } from "react";
import {
  DocumentItem,
  RagQueryResponse,
  fetchDocuments,
  uploadPdfDocument,
  deleteDocumentById,
  queryDocumentRag,
} from "@/lib/api";

const SAMPLE_PROMPTS = [
  "Summarize the key projects, metrics, and technical impact mentioned in this document.",
  "What certifications, tools, and technical skills are listed?",
  "What is the company's 2029 submarine budget? (Hallucination Trap Test)",
];

export default function EvaluatedRagDashboard() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [response, setResponse] = useState<RagQueryResponse | null>(null);

  const [loadingDocs, setLoadingDocs] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [markAsDemo, setMarkAsDemo] = useState<boolean>(false);
  const [querying, setQuerying] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRawChunks, setShowRawChunks] = useState<boolean>(false);

  const selectedDoc = documents.find((d) => d.id === selectedDocId);

  const loadDocuments = async (preferId?: string) => {
    try {
      setLoadingDocs(true);
      const docs = await fetchDocuments();
      setDocuments(docs);
      if (preferId) {
        setSelectedDocId(preferId);
      } else if (docs.length > 0 && !selectedDocId) {
        const demoDoc = docs.find((d) => d.is_demo) || docs[0];
        setSelectedDocId(demoDoc.id);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Could not connect to backend API.");
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setUploading(true);
    try {
      const uploaded = await uploadPdfDocument(file, markAsDemo);
      await loadDocuments(uploaded.document_id);
      setResponse(null);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to upload PDF.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteDoc = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDocumentById(docId);
      const updated = documents.filter((d) => d.id !== docId);
      setDocuments(updated);
      if (selectedDocId === docId) {
        setSelectedDocId(updated[0]?.id || "");
        setResponse(null);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to delete document.");
    }
  };

  const handleAsk = async (customQuery?: string) => {
    const activeQuery = (customQuery ?? query).trim();
    if (!selectedDocId || !activeQuery) return;

    if (customQuery) setQuery(customQuery);
    setErrorMsg(null);
    setQuerying(true);
    setShowRawChunks(false);

    try {
      const res = await queryDocumentRag(selectedDocId, activeQuery, 5);
      setResponse(res);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Query execution failed.");
    } finally {
      setQuerying(false);
    }
  };

  const activateGuestDemo = () => {
    const demoDoc = documents.find((d) => d.is_demo) || documents[0];
    if (demoDoc) {
      setSelectedDocId(demoDoc.id);
      handleAsk(SAMPLE_PROMPTS[0]);
    }
  };

  const scorePct = response ? Math.round(response.evaluation.faithfulness_score * 100) : 0;

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-200">
      
      {/* Simple Header */}
      <header className="border-b border-gray-200 px-6 py-4 lg:px-12 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold inline">VeriRAG</h1>
          <span className="text-gray-500 ml-2 hidden sm:inline">Evaluated Document Assistant</span>
        </div>
        <button
          onClick={activateGuestDemo}
          disabled={documents.length === 0 || querying}
          className="text-sm font-medium text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
        >
          Try Instant Guest Demo
        </button>
      </header>

      {/* Classic Page Layout */}
      <div className="mx-auto max-w-6xl px-6 py-8 lg:px-12 grid grid-cols-1 md:grid-cols-12 gap-12">
        
        {/* Left Column: Documents (Minimalist list) */}
        <aside className="md:col-span-4 lg:col-span-3 space-y-8">
          
          <section>
            <h2 className="text-sm font-bold text-gray-900 mb-4 tracking-wide uppercase">1. Add Document</h2>
            <div className="space-y-3">
              {uploading ? (
                <p className="text-sm text-blue-600">Uploading and processing PDF...</p>
              ) : (
                <input 
                  type="file" 
                  accept=".pdf,application/pdf" 
                  onChange={handleFileUpload} 
                  disabled={uploading} 
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
                />
              )}
              <label className="flex items-center gap-2 text-xs text-gray-500">
                <input type="checkbox" checked={markAsDemo} onChange={(e) => setMarkAsDemo(e.target.checked)} className="rounded border-gray-300" />
                Pin as pre-loaded demo
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold text-gray-900 mb-4 tracking-wide uppercase">2. Active Context</h2>
            {loadingDocs ? (
              <p className="text-sm text-gray-500">Loading documents...</p>
            ) : documents.length === 0 ? (
              <p className="text-sm text-gray-500">No documents found. Please upload a PDF.</p>
            ) : (
              <ul className="space-y-3">
                {documents.map((doc) => {
                  const active = doc.id === selectedDocId;
                  return (
                    <li key={doc.id} className="flex items-start justify-between gap-2">
                      <button 
                        onClick={() => { setSelectedDocId(doc.id); setResponse(null); }}
                        className={`text-left text-sm ${active ? "font-bold text-black" : "text-gray-600 hover:text-black"}`}
                      >
                        {doc.title}
                        <span className="block text-xs font-normal text-gray-500 mt-0.5">
                          {doc.page_count} {doc.page_count === 1 ? "page" : "pages"} {doc.is_demo && "• Demo"}
                        </span>
                      </button>
                      <button 
                        onClick={(e) => handleDeleteDoc(doc.id, e)} 
                        className="text-xs text-gray-400 hover:text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>

        {/* Right Column: Interaction and Output */}
        <main className="md:col-span-8 lg:col-span-9">
          
          {errorMsg && (
            <p className="mb-6 text-sm font-medium text-red-600">{errorMsg}</p>
          )}

          {/* Form */}
          <section className="mb-10">
            <h2 className="text-sm font-bold text-gray-900 mb-4 tracking-wide uppercase">
              3. Query Document
            </h2>
            <form onSubmit={(e) => { e.preventDefault(); handleAsk(); }} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={selectedDoc ? `Ask a question about ${selectedDoc.title}...` : "Select a document first"}
                disabled={!selectedDocId || querying}
                className="flex-1 rounded border border-gray-300 px-4 py-2.5 text-base focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
              />
              <button
                type="submit"
                disabled={!selectedDocId || !query.trim() || querying}
                className="rounded bg-black px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {querying ? "Searching..." : "Submit"}
              </button>
            </form>
            
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              <span className="text-xs font-medium text-gray-500">Suggestions:</span>
              {SAMPLE_PROMPTS.map((sample, idx) => (
                <button
                  key={idx}
                  disabled={!selectedDocId || querying}
                  onClick={() => handleAsk(sample)}
                  className="text-xs text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline text-left"
                >
                  {sample}
                </button>
              ))}
            </div>
          </section>

          {/* Results Box-free layout */}
          {response && !querying && (
            <section className="space-y-8 animate-in fade-in duration-500">
              <hr className="border-gray-200" />
              
              {/* Meta information rendered as plain text rows */}
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <strong>Faithfulness Score:</strong>{" "}
                  <span className={scorePct >= 85 ? "text-green-700" : "text-orange-600"}>{scorePct}%</span>{" "}
                  ({response.evaluation.supported_claims} of {response.evaluation.total_claims} claims verified by NLI Judge)
                </p>
                <p>
                  <strong>Grounding Status:</strong>{" "}
                  {response.is_answerable ? "Answerable based on context" : "Refused (Out of Scope)"}
                </p>
                <p>
                  <strong>Execution Latency:</strong> {(response.metrics.total_ms / 1000).toFixed(2)}s 
                  <span className="text-gray-400 ml-1">(Search: {response.metrics.retrieval_ms}ms, Generation: {response.metrics.generation_ms}ms)</span>
                </p>
              </div>

              {/* Main Text Answer */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">Answer</h3>
                <div className="prose max-w-none text-gray-800 text-base leading-relaxed whitespace-pre-line">
                  {response.answer}
                </div>
                <p className="mt-4 text-sm font-medium text-gray-600">
                  Audit Verdict: <span className="font-normal">{response.evaluation.verdict}</span>
                </p>
              </div>

              {/* Text-based Citations */}
              {response.citations.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Supporting Citations</h3>
                  <ul className="space-y-4">
                    {response.citations.map((cit, i) => (
                      <li key={i} className="text-base text-gray-700">
                        <strong className="text-gray-900">Page {cit.page_number}</strong> (Chunk {cit.chunk_index}): 
                        <blockquote className="mt-1 border-l-4 border-gray-200 pl-4 italic text-gray-600">
                          &ldquo;{cit.quote}&rdquo;
                        </blockquote>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Native HTML details/summary for raw chunks (no JS toggle needed) */}
              <div className="pt-4">
                <details className="group cursor-pointer">
                  <summary className="text-sm font-medium text-blue-600 hover:underline outline-none">
                    View raw retrieved hybrid search chunks (Top {response.retrieved_chunks.length})
                  </summary>
                  <div className="mt-4 space-y-6 cursor-text">
                    {response.retrieved_chunks.map((chunk) => (
                      <div key={chunk.chunk_id}>
                        <p className="text-sm font-bold text-gray-900 mb-1">
                          Page {chunk.page_number} <span className="text-gray-500 font-normal">| RRF Score: {chunk.rrf_score.toFixed(4)}</span>
                        </p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                          {chunk.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              </div>

            </section>
          )}

        </main>
      </div>
    </div>
  );
}