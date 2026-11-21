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
  CheckCircle2,
  Info,
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
    // FULL EDGE-TO-EDGE DESKTOP APP WRAPPER
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white font-sans text-[#1d1d1f] selection:bg-[#007aff] selection:text-white">
      
      {/* COMPACT TOP NAVIGATION BAR */}
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-black/5 bg-[#f5f5f7] px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-[#007aff]" />
          <h1 className="text-sm font-semibold tracking-wide text-[#1d1d1f]">
            VeriRAG <span className="font-normal text-[#8e8e93]">Evaluated Document Assistant</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={activateGuestDemo}
            disabled={documents.length === 0 || querying}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1d1d1f] px-4 py-1.5 text-xs font-semibold text-white transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-50 shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Try Instant Guest Demo
          </button>
        </div>
      </header>

      {/* MAIN SPLIT-PANE WORKSPACE */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* LEFT SIDEBAR: KNOWLEDGE BASE */}
        <aside className="flex w-[320px] lg:w-[380px] flex-col border-r border-black/5 bg-[#f5f5f7] shrink-0 z-10 shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
          
          {/* Section 1: Upload */}
          <div className="p-5 border-b border-black/5">
            <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#8e8e93]">
              <Database className="h-3.5 w-3.5 text-[#007aff]" />
              Index a PDF Document
            </h2>

            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#c7c7cc] bg-white p-5 transition-all hover:border-[#007aff] hover:bg-[#f0f9ff]">
              {uploading ? (
                <div className="flex flex-col items-center gap-2 text-[#007aff]">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-xs font-medium">Generating embeddings...</span>
                </div>
              ) : (
                <>
                  <Upload className="mb-2 h-5 w-5 text-[#8e8e93]" />
                  <span className="text-sm font-medium text-[#1d1d1f]">Upload PDF File</span>
                  <span className="mt-1 text-[11px] text-[#8e8e93]">Max 15 MB</span>
                </>
              )}
              <input type="file" accept=".pdf,application/pdf" onChange={handleFileUpload} disabled={uploading} className="hidden" />
            </label>

            <label className="mt-3 flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-[#8e8e93] transition hover:text-[#1d1d1f]">
              <input type="checkbox" checked={markAsDemo} onChange={(e) => setMarkAsDemo(e.target.checked)} className="rounded border-[#c7c7cc] text-[#007aff] focus:ring-[#007aff]" />
              Pin as pre-loaded Guest Demo
            </label>
          </div>

          {/* Section 2: Document List */}
          <div className="flex flex-1 flex-col overflow-hidden p-5">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#8e8e93]">
              Active Documents ({documents.length})
            </h2>

            {loadingDocs ? (
              <div className="flex items-center gap-2 text-xs text-[#8e8e93]">
                <Loader2 className="h-4 w-4 animate-spin" /> Syncing database...
              </div>
            ) : documents.length === 0 ? (
              <div className="rounded-xl border border-black/5 bg-white p-4 text-center text-xs text-[#8e8e93] shadow-sm">
                No documents indexed. Upload a PDF to begin.
              </div>
            ) : (
              <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto pr-2">
                {documents.map((doc) => {
                  const active = doc.id === selectedDocId;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => { setSelectedDocId(doc.id); setResponse(null); }}
                      className={`group flex cursor-pointer items-start justify-between gap-2 rounded-xl border p-3.5 transition-all ${
                        active ? "border-[#007aff] bg-white shadow-[0_2px_10px_rgba(0,122,255,0.1)]" : "border-black/5 bg-white hover:border-[#c7c7cc]"
                      }`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${active ? "bg-[#007aff]/10" : "bg-[#f2f2f7]"}`}>
                          <FileText className={`h-4 w-4 ${active ? "text-[#007aff]" : "text-[#8e8e93]"}`} />
                        </div>
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-semibold ${active ? "text-[#1d1d1f]" : "text-[#1d1d1f]/80"}`}>{doc.title}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-[11px] font-medium text-[#8e8e93]">{doc.page_count} {doc.page_count === 1 ? "page" : "pages"}</span>
                            {doc.is_demo && <span className="rounded bg-[#34c759]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#34c759]">DEMO</span>}
                          </div>
                        </div>
                      </div>
                      <button onClick={(e) => handleDeleteDoc(doc.id, e)} className="rounded p-1.5 text-[#8e8e93] opacity-0 transition-opacity hover:bg-[#ff3b30]/10 hover:text-[#ff3b30] group-hover:opacity-100">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT MAIN AREA: QUERY & RESULTS */}
        <main className="flex flex-1 flex-col bg-white relative">
          
          {/* Scrollable Results Area */}
          <div className="custom-scrollbar flex-1 overflow-y-auto p-6 lg:p-10 pb-32">
            <div className="mx-auto max-w-4xl space-y-6">
              
              {errorMsg && (
                <div className="flex items-center gap-3 rounded-xl border border-[#ff3b30]/20 bg-[#ff3b30]/5 p-4 text-sm font-medium text-[#ff3b30]">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  {errorMsg}
                </div>
              )}

              {!response && !querying && !errorMsg && (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#c7c7cc] bg-[#f5f5f7]/50 py-20 text-center px-4">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm border border-black/5">
                    <ShieldCheck className="h-8 w-8 text-[#007aff]" />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight text-[#1d1d1f]">VeriRAG Engine Ready</h3>
                  <p className="mt-2 max-w-md text-sm text-[#8e8e93]">
                    Select a document and ask a question below. The engine uses Hybrid Vector + RRF Search, generates inline citations, and audits every factual claim via NLI.
                  </p>
                </div>
              )}

              {querying && (
                <div className="flex flex-col items-center justify-center py-20 text-[#007aff]">
                  <Loader2 className="mb-4 h-8 w-8 animate-spin" />
                  <p className="text-sm font-semibold">Retrieving context & auditing response...</p>
                </div>
              )}

              {response && !querying && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  
                  {/* Apple Bento Box Metrics Row */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className={`flex flex-col justify-between rounded-[1.5rem] border border-black/5 p-5 shadow-sm ${scorePct >= 85 ? "bg-[#34c759]/5" : "bg-[#ff9500]/5"}`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8e8e93]">Faithfulness Judge</span>
                        {scorePct >= 85 ? <CheckCircle2 className="h-4 w-4 text-[#34c759]" /> : <AlertTriangle className="h-4 w-4 text-[#ff9500]" />}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-semibold tracking-tighter ${scorePct >= 85 ? "text-[#34c759]" : "text-[#ff9500]"}`}>{scorePct}%</span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-[#8e8e93]">
                        {response.evaluation.supported_claims} of {response.evaluation.total_claims} claims verified
                      </p>
                    </div>

                    <div className="flex flex-col justify-between rounded-[1.5rem] border border-black/5 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8e8e93]">Pipeline Latency</span>
                        <Clock className="h-4 w-4 text-[#007aff]" />
                      </div>
                      <p className="text-4xl font-semibold tracking-tighter text-[#1d1d1f]">{(response.metrics.total_ms / 1000).toFixed(2)}s</p>
                      <p className="mt-1 text-[11px] font-medium text-[#8e8e93] truncate">
                        Search: {response.metrics.retrieval_ms}ms • Gen: {response.metrics.generation_ms}ms
                      </p>
                    </div>

                    <div className="flex flex-col justify-between rounded-[1.5rem] border border-black/5 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8e8e93]">Grounding Status</span>
                        <Info className="h-4 w-4 text-[#1d1d1f]/40" />
                      </div>
                      <p className={`text-xl font-semibold tracking-tight ${response.is_answerable ? "text-[#1d1d1f]" : "text-[#ff9500]"}`}>
                        {response.is_answerable ? "Grounded in Context" : "Safe Refusal (Out of Scope)"}
                      </p>
                      <p className="mt-1 text-xs font-medium text-[#8e8e93] truncate">{response.metrics.model_used}</p>
                    </div>
                  </div>

                  {/* Main Answer Card */}
                  <div className="rounded-[1.5rem] border border-black/5 bg-white p-6 shadow-sm sm:p-8">
                    <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[#007aff]">Verified Answer</h3>
                    <div className="prose prose-sm md:prose-base max-w-none text-[#1d1d1f] leading-relaxed whitespace-pre-line">
                      {response.answer}
                    </div>
                    <div className="mt-6 rounded-xl bg-[#f5f5f7] p-4 text-sm font-medium text-[#1d1d1f]">
                      <span className="text-[#8e8e93]">Audit Verdict:</span> {response.evaluation.verdict}
                    </div>
                  </div>

                  {/* Inline Citations */}
                  {response.citations.length > 0 && (
                    <div className="rounded-[1.5rem] border border-black/5 bg-white p-6 shadow-sm">
                      <h3 className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#8e8e93]">
                        <BookOpen className="h-4 w-4 text-[#007aff]" /> Supporting Evidence Citations
                      </h3>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {response.citations.map((cit, i) => (
                          <div key={i} className="rounded-xl border border-black/5 bg-[#f9f9f9] p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="rounded-md bg-[#007aff]/10 px-2 py-1 text-[10px] font-bold text-[#007aff]">PAGE {cit.page_number}</span>
                              <span className="text-[10px] font-semibold text-[#8e8e93]">CHUNK #{cit.chunk_index}</span>
                            </div>
                            <p className="text-sm font-medium italic text-[#1d1d1f]/80 leading-relaxed">&ldquo;{cit.quote}&rdquo;</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Raw Hybrid Search Chunks */}
                  <div className="rounded-[1.5rem] border border-black/5 bg-white shadow-sm overflow-hidden">
                    <button
                      onClick={() => setShowRawChunks(!showRawChunks)}
                      className="flex w-full items-center justify-between bg-white px-6 py-4 text-sm font-semibold text-[#1d1d1f] transition-colors hover:bg-[#f5f5f7]"
                    >
                      <span>Inspect Top-{response.retrieved_chunks.length} Hybrid Search Chunks (Vector + RRF)</span>
                      {showRawChunks ? <ChevronUp className="h-5 w-5 text-[#8e8e93]" /> : <ChevronDown className="h-5 w-5 text-[#8e8e93]" />}
                    </button>
                    {showRawChunks && (
                      <div className="border-t border-black/5 bg-[#f9f9f9] p-6 space-y-4">
                        {response.retrieved_chunks.map((chunk) => (
                          <div key={chunk.chunk_id} className="rounded-xl border border-black/5 bg-white p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-xs font-semibold text-[#1d1d1f]">Page {chunk.page_number} <span className="font-normal text-[#8e8e93]">/ Chunk #{chunk.chunk_index}</span></span>
                              <span className="font-mono text-xs font-semibold text-[#34c759]">RRF: {chunk.rrf_score.toFixed(4)}</span>
                            </div>
                            <p className="text-sm text-[#1d1d1f]/80 leading-relaxed whitespace-pre-line">{chunk.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                </div>
              )}
            </div>
          </div>

          {/* FLOATING COMMAND BAR (Pinned to bottom of workspace) */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-black/5 bg-white/80 p-4 lg:p-6 backdrop-blur-xl">
            <div className="mx-auto max-w-4xl">
              
              {/* Sample Prompts */}
              <div className="mb-3 hidden flex-wrap gap-2 md:flex">
                {SAMPLE_PROMPTS.map((sample, idx) => (
                  <button
                    key={idx}
                    disabled={!selectedDocId || querying}
                    onClick={() => handleAsk(sample)}
                    className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-medium text-[#8e8e93] transition-all hover:border-[#007aff] hover:text-[#007aff] disabled:pointer-events-none disabled:opacity-40 shadow-sm"
                  >
                    {sample}
                  </button>
                ))}
              </div>

              {/* Main Input Form */}
              <form onSubmit={(e) => { e.preventDefault(); handleAsk(); }} className="relative flex items-center shadow-lg rounded-2xl">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={selectedDoc ? `Ask about "${selectedDoc.title}"...` : "Select a document first..."}
                  disabled={!selectedDocId || querying}
                  className="h-14 w-full rounded-2xl border-2 border-transparent bg-[#f5f5f7] pl-5 pr-32 text-base font-medium text-[#1d1d1f] placeholder:text-[#8e8e93] focus:border-[#007aff] focus:bg-white focus:outline-none disabled:opacity-60 transition-all shadow-inner"
                />
                <div className="absolute right-2">
                  <button
                    type="submit"
                    disabled={!selectedDocId || !query.trim() || querying}
                    className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#007aff] px-5 text-sm font-semibold text-white shadow-md transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                  >
                    {querying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <span className="hidden sm:inline">{querying ? "Auditing" : "Ask"}</span>
                  </button>
                </div>
              </form>

            </div>
          </div>
        </main>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d1d1d6; border-radius: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #c7c7cc; }
      `}} />
    </div>
  );
}