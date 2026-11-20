"use client";

import React, { useEffect, useState } from "react";
import {
  FileText,
  Upload,
  Send,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Sparkles,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Trash2,
  Loader2,
  Database,
} from "lucide-react";
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              VeriRAG <span className="text-indigo-400">• Evaluated Document Assistant</span>
            </h1>
            <p className="text-xs text-slate-400">
              Hybrid Search (pgvector + RRF) • Structured Citations • Live NLI Faithfulness Judge
            </p>
          </div>
        </div>

        <button
          onClick={activateGuestDemo}
          disabled={documents.length === 0 || querying}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-sm font-medium text-white transition cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          Try Instant Guest Demo
        </button>
      </header>

      {/* Main Split Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 max-w-7xl w-full mx-auto">
        {/* Left Sidebar: Document Knowledge Base */}
        <aside className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-800 p-5 flex flex-col gap-5 bg-slate-900/30">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" />
              1. Index a PDF Document
            </h2>

            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-5 cursor-pointer transition bg-slate-900/60">
              {uploading ? (
                <div className="flex flex-col items-center gap-2 text-indigo-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-xs font-medium">Chunking & generating embeddings...</span>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-slate-400 mb-2" />
                  <span className="text-sm font-medium text-slate-200">Upload PDF (max 15 MB)</span>
                  <span className="text-xs text-slate-500 mt-1">Selectable text PDFs supported</span>
                </>
              )}
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>

            <label className="mt-2.5 flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={markAsDemo}
                onChange={(e) => setMarkAsDemo(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-indigo-500"
              />
              Pin as pre-loaded Demo Document for guests
            </label>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              2. Select Active Document ({documents.length})
            </h2>

            {loadingDocs ? (
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading indexed documents...
              </div>
            ) : documents.length === 0 ? (
              <div className="text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-lg p-4">
                No documents indexed yet. Upload a PDF above to begin.
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto pr-1">
                {documents.map((doc) => {
                  const active = doc.id === selectedDocId;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => {
                        setSelectedDocId(doc.id);
                        setResponse(null);
                      }}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-start justify-between gap-2 ${
                        active
                          ? "bg-indigo-600/15 border-indigo-500 text-white"
                          : "bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <FileText
                          className={`w-4 h-4 mt-0.5 shrink-0 ${
                            active ? "text-indigo-400" : "text-slate-500"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{doc.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] text-slate-400">
                              {doc.page_count} {doc.page_count === 1 ? "page" : "pages"}
                            </span>
                            {doc.is_demo && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                                DEMO
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDeleteDoc(doc.id, e)}
                        title="Delete document"
                        className="text-slate-500 hover:text-rose-400 p-1 rounded transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Right Main Workspace: Query, Grounded Answer, Faithfulness Audit & Citations */}
        <main className="lg:col-span-8 p-6 flex flex-col gap-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-sm flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Query Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">
                Active Context:{" "}
                <strong className="text-slate-200">
                  {selectedDoc ? selectedDoc.title : "None selected"}
                </strong>
              </span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAsk();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a factual question grounded in the selected PDF..."
                disabled={!selectedDocId || querying}
                className="flex-1 bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={!selectedDocId || !query.trim() || querying}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-sm font-medium text-white inline-flex items-center gap-2 transition cursor-pointer"
              >
                {querying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Auditing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Ask
                  </>
                )}
              </button>
            </form>

            {/* Quick Test Prompts */}
            <div className="mt-3 flex flex-wrap gap-2">
              {SAMPLE_PROMPTS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={!selectedDocId || querying}
                  onClick={() => handleAsk(sample)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-800 text-slate-300 border border-slate-700/70 transition text-left cursor-pointer disabled:opacity-40"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>

          {/* Results Area */}
          {response ? (
            <div className="space-y-5">
              {/* Telemetry & Faithfulness Audit Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div
                  className={`p-4 rounded-xl border ${
                    scorePct >= 85
                      ? "bg-emerald-950/30 border-emerald-500/40"
                      : "bg-amber-950/30 border-amber-500/40"
                  }`}
                >
                  <div className="text-xs text-slate-400">Faithfulness Score (NLI Judge)</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span
                      className={`text-2xl font-bold ${
                        scorePct >= 85 ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {scorePct}%
                    </span>
                    <span className="text-xs text-slate-400">
                      ({response.evaluation.supported_claims}/{response.evaluation.total_claims}{" "}
                      claims verified)
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" /> Pipeline Latency
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-100">
                    {(response.metrics.total_ms / 1000).toFixed(2)}s{" "}
                    <span className="text-xs font-normal text-slate-400">total</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Search {response.metrics.retrieval_ms}ms • Gen {response.metrics.generation_ms}ms
                    • Audit {response.metrics.evaluation_ms}ms
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-xs text-slate-400">Grounding Status</div>
                  <div className="mt-1 text-sm font-semibold">
                    {response.is_answerable ? (
                      <span className="text-indigo-400">Grounded in Document</span>
                    ) : (
                      <span className="text-amber-400">Safe Refusal (Out of Scope)</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {response.metrics.model_used}
                  </div>
                </div>
              </div>

              {/* Generated Answer Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">
                  Verified Answer
                </h3>
                <p className="text-sm leading-relaxed text-slate-100 whitespace-pre-line">
                  {response.answer}
                </p>
                <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400">
                  <strong className="text-slate-300">Audit Verdict:</strong>{" "}
                  {response.evaluation.verdict}
                </div>
              </div>

              {/* Inline Citations List */}
              {response.citations.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-400" />
                    Supporting Evidence Citations ({response.citations.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {response.citations.map((cit, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium">
                            Page {cit.page_number}
                          </span>
                          <span className="text-slate-500">Chunk #{cit.chunk_index}</span>
                        </div>
                        <p className="text-slate-300 italic">&ldquo;{cit.quote}&rdquo;</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expandable Raw Hybrid Search Chunks */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowRawChunks(!showRawChunks)}
                  className="w-full px-5 py-3.5 flex items-center justify-between text-xs font-medium text-slate-300 hover:bg-slate-900 transition cursor-pointer"
                >
                  <span>
                    Inspect Top-{response.retrieved_chunks.length} Hybrid Search Chunks (Vector +
                    Full-Text RRF Scores)
                  </span>
                  {showRawChunks ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {showRawChunks && (
                  <div className="p-5 pt-0 space-y-3 border-t border-slate-800/80">
                    {response.retrieved_chunks.map((chunk) => (
                      <div
                        key={chunk.chunk_id}
                        className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-slate-400">
                          <span>
                            <strong>Page {chunk.page_number}</strong> • Chunk #{chunk.chunk_index}
                          </span>
                          <span className="font-mono text-emerald-400">
                            RRF Score: {chunk.rrf_score}
                          </span>
                        </div>
                        <p className="text-slate-300 whitespace-pre-line leading-relaxed">
                          {chunk.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10 border border-dashed border-slate-800 rounded-2xl text-slate-500">
              <ShieldCheck className="w-10 h-10 text-slate-700 mb-3" />
              <p className="text-sm font-medium text-slate-300">
                Ask a question or click &ldquo;Try Instant Guest Demo&rdquo;
              </p>
              <p className="text-xs max-w-md mt-1">
                Every response runs hybrid vector + keyword retrieval, generates inline page
                citations, and audits every factual claim for faithfulness.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}