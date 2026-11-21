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
    // UNLOCKED LAYOUT: min-h-screen allows normal vertical page scrolling
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1d1d1f] selection:bg-[#007aff] selection:text-white">
      
      {/* STICKY TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-50 flex h-[60px] shrink-0 items-center justify-between border-b border-black/5 bg-[#f5f5f7]/90 px-4 backdrop-blur-md lg:px-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-[#007aff]" />
          <h1 className="text-base font-semibold tracking-wide text-[#1d1d1f]">
            VeriRAG <span className="font-normal text-[#8e8e93]">Evaluated Document Assistant</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={activateGuestDemo}
            disabled={documents.length === 0 || querying}
            className="inline-flex items-center gap-2 rounded-full bg-[#1d1d1f] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            Try Instant Guest Demo
          </button>
        </div>
      </header>

      {/* MAIN WORKSPACE WRAPPER */}
      <div className="flex flex-1 flex-col lg:flex-row">
        
        {/* STICKY LEFT SIDEBAR */}
        {/* On desktop, it sticks below the 60px header and spans the remaining viewport height */}
        <aside className="z-40 flex w-full shrink-0 flex-col border-b border-black/5 bg-[#f5f5f7] lg:sticky lg:top-[60px] lg:h-[calc(100vh-60px)] lg:w-[420px] lg:border-b-0 lg:border-r shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
          
          {/* Section 1: Upload */}
          <div className="border-b border-black/5 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#8e8e93]">
              <Database className="h-4 w-4 text-[#007aff]" />
              Index a PDF Document
            </h2>

            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#c7c7cc] bg-white p-6 transition-all hover:border-[#007aff] hover:bg-[#f0f9ff]">
              {uploading ? (
                <div className="flex flex-col items-center gap-3 text-[#007aff]">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-sm font-medium">Generating embeddings...</span>
                </div>
              ) : (
                <>
                  <Upload className="mb-3 h-6 w-6 text-[#8e8e93]" />
                  <span className="text-base font-semibold text-[#1d1d1f]">Upload PDF File</span>
                  <span className="mt-1 text-xs font-medium text-[#8e8e93]">Max 15 MB</span>
                </>
              )}
              <input type="file" accept=".pdf,application/pdf" onChange={handleFileUpload} disabled={uploading} className="hidden" />
            </label>

            <label className="mt-4 flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-[#8e8e93] transition hover:text-[#1d1d1f]">
              <input type="checkbox" checked={markAsDemo} onChange={(e) => setMarkAsDemo(e.target.checked)} className="h-4 w-4 rounded border-[#c7c7cc] text-[#007aff] focus:ring-[#007aff]" />
              Pin as pre-loaded Guest Demo
            </label>
          </div>

          {/* Section 2: Document List */}
          <div className="flex flex-1 flex-col overflow-hidden p-6">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-[#8e8e93]">
              Active Documents ({documents.length})
            </h2>

            {loadingDocs ? (
              <div className="flex items-center gap-2 text-sm font-medium text-[#8e8e93]">
                <Loader2 className="h-5 w-5 animate-spin" /> Syncing database...
              </div>
            ) : documents.length === 0 ? (
              <div className="rounded-xl border border-black/5 bg-white p-5 text-center text-sm font-medium text-[#8e8e93] shadow-sm">
                No documents indexed. Upload a PDF to begin.
              </div>
            ) : (
              <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-3">
                {documents.map((doc) => {
                  const active = doc.id === selectedDocId;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => { setSelectedDocId(doc.id); setResponse(null); }}
                      className={`group flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-4 transition-all ${
                        active ? "border-[#007aff] bg-white shadow-[0_2px_12px_rgba(0,122,255,0.12)]" : "border-black/5 bg-white hover:border-[#c7c7cc]"
                      }`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-[#007aff]/10" : "bg-[#f2f2f7]"}`}>
                          <FileText className={`h-5 w-5 ${active ? "text-[#007aff]" : "text-[#8e8e93]"}`} />
                        </div>
                        <div className="min-w-0">
                          <p className={`truncate text-base font-semibold ${active ? "text-[#1d1d1f]" : "text-[#1d1d1f]/80"}`}>{doc.title}</p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="text-xs font-medium text-[#8e8e93]">{doc.page_count} {doc.page_count === 1 ? "page" : "pages"}</span>
                            {doc.is_demo && <span className="rounded bg-[#34c759]/10 px-2 py-0.5 text-[10px] font-bold text-[#34c759]">DEMO</span>}
                          </div>
                        </div>
                      </div>
                      <button onClick={(e) => handleDeleteDoc(doc.id, e)} className="rounded p-1.5 text-[#8e8e93] opacity-0 transition-opacity hover:bg-[#ff3b30]/10 hover:text-[#ff3b30] group-hover:opacity-100">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT MAIN AREA (NATURAL SCROLL) */}
        <main className="flex flex-1 flex-col bg-white">
          
          <div className="mx-auto w-full max-w-5xl p-6 pb-48 lg:p-12">
            <div className="space-y-8">
              
              {errorMsg && (
                <div className="flex items-center gap-3 rounded-xl border border-[#ff3b30]/20 bg-[#ff3b30]/5 p-5 text-base font-medium text-[#ff3b30]">
                  <AlertTriangle className="h-6 w-6 shrink-0" />
                  {errorMsg}
                </div>
              )}

              {!response && !querying && !errorMsg && (
                <div className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-[#c7c7cc] bg-[#f5f5f7]/50 px-6 py-24 text-center">
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-black/5 bg-white shadow-sm">
                    <ShieldCheck className="h-10 w-10 text-[#007aff]" />
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">VeriRAG Engine Ready</h3>
                  <p className="mt-3 max-w-lg text-base text-[#8e8e93]">
                    Select a document and ask a question below. The engine uses Hybrid Vector + RRF Search, generates inline citations, and audits every factual claim via NLI.
                  </p>
                </div>
              )}

              {querying && (
                <div className="flex flex-col items-center justify-center py-24 text-[#007aff]">
                  <Loader2 className="mb-5 h-10 w-10 animate-spin" />
                  <p className="text-base font-semibold">Retrieving context & auditing response...</p>
                </div>
              )}

              {response && !querying && (
                <div className="duration-500 animate-in fade-in slide-in-from-bottom-4 space-y-8">
                  
                  {/* Apple Bento Box Metrics Row */}
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    <div className={`flex flex-col justify-between rounded-[2rem] border border-black/5 p-6 shadow-sm ${scorePct >= 85 ? "bg-[#34c759]/5" : "bg-[#ff9500]/5"}`}>
                      <div className="mb-4 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#8e8e93]">Faithfulness Judge</span>
                        {scorePct >= 85 ? <CheckCircle2 className="h-5 w-5 text-[#34c759]" /> : <AlertTriangle className="h-5 w-5 text-[#ff9500]" />}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-5xl font-bold tracking-tighter ${scorePct >= 85 ? "text-[#34c759]" : "text-[#ff9500]"}`}>{scorePct}%</span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-[#8e8e93]">
                        {response.evaluation.supported_claims} of {response.evaluation.total_claims} claims verified
                      </p>
                    </div>

                    <div className="flex flex-col justify-between rounded-[2rem] border border-black/5 bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#8e8e93]">Pipeline Latency</span>
                        <Clock className="h-5 w-5 text-[#007aff]" />
                      </div>
                      <p className="text-5xl font-bold tracking-tighter text-[#1d1d1f]">{(response.metrics.total_ms / 1000).toFixed(2)}s</p>
                      <p className="mt-2 truncate text-sm font-medium text-[#8e8e93]">
                        Search: {response.metrics.retrieval_ms}ms • Gen: {response.metrics.generation_ms}ms
                      </p>
                    </div>

                    <div className="flex flex-col justify-between rounded-[2rem] border border-black/5 bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#8e8e93]">Grounding Status</span>
                        <Info className="h-5 w-5 text-[#1d1d1f]/40" />
                      </div>
                      <p className={`text-2xl font-bold tracking-tight ${response.is_answerable ? "text-[#1d1d1f]" : "text-[#ff9500]"}`}>
                        {response.is_answerable ? "Grounded in Context" : "Safe Refusal (Out of Scope)"}
                      </p>
                      <p className="mt-2 truncate text-sm font-medium text-[#8e8e93]">{response.metrics.model_used}</p>
                    </div>
                  </div>

                  {/* Main Answer Card */}
                  <div className="rounded-[2rem] border border-black/5 bg-white p-8 shadow-sm sm:p-10">
                    <h3 className="mb-5 text-xs font-bold uppercase tracking-wider text-[#007aff]">Verified Answer</h3>
                    <div className="prose prose-base max-w-none whitespace-pre-line font-medium leading-relaxed text-[#1d1d1f] md:prose-lg">
                      {response.answer}
                    </div>
                    <div className="mt-8 rounded-xl bg-[#f5f5f7] p-5 text-base font-semibold text-[#1d1d1f]">
                      <span className="mr-2 text-[#8e8e93]">Audit Verdict:</span> {response.evaluation.verdict}
                    </div>
                  </div>

                  {/* Inline Citations */}
                  {response.citations.length > 0 && (
                    <div className="rounded-[2rem] border border-black/5 bg-white p-8 shadow-sm">
                      <h3 className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#8e8e93]">
                        <BookOpen className="h-5 w-5 text-[#007aff]" /> Supporting Evidence Citations
                      </h3>
                      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        {response.citations.map((cit, i) => (
                          <div key={i} className="rounded-xl border border-black/5 bg-[#f9f9f9] p-5">
                            <div className="mb-3 flex items-center justify-between">
                              <span className="rounded-md bg-[#007aff]/10 px-2.5 py-1 text-xs font-bold text-[#007aff]">PAGE {cit.page_number}</span>
                              <span className="text-xs font-bold text-[#8e8e93]">CHUNK #{cit.chunk_index}</span>
                            </div>
                            <p className="text-base font-medium italic leading-relaxed text-[#1d1d1f]/80">&ldquo;{cit.quote}&rdquo;</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Raw Hybrid Search Chunks */}
                  <div className="overflow-hidden rounded-[2rem] border border-black/5 bg-white shadow-sm">
                    <button
                      onClick={() => setShowRawChunks(!showRawChunks)}
                      className="flex w-full items-center justify-between bg-white px-8 py-5 text-base font-bold text-[#1d1d1f] transition-colors hover:bg-[#f5f5f7]"
                    >
                      <span>Inspect Top-{response.retrieved_chunks.length} Hybrid Search Chunks (Vector + RRF)</span>
                      {showRawChunks ? <ChevronUp className="h-6 w-6 text-[#8e8e93]" /> : <ChevronDown className="h-6 w-6 text-[#8e8e93]" />}
                    </button>
                    {showRawChunks && (
                      <div className="space-y-5 border-t border-black/5 bg-[#f9f9f9] p-8">
                        {response.retrieved_chunks.map((chunk) => (
                          <div key={chunk.chunk_id} className="rounded-xl border border-black/5 bg-white p-5">
                            <div className="mb-3 flex items-center justify-between">
                              <span className="text-sm font-bold text-[#1d1d1f]">Page {chunk.page_number} <span className="font-normal text-[#8e8e93]">/ Chunk #{chunk.chunk_index}</span></span>
                              <span className="font-mono text-sm font-bold text-[#34c759]">RRF: {chunk.rrf_score.toFixed(4)}</span>
                            </div>
                            <p className="whitespace-pre-line text-base font-medium leading-relaxed text-[#1d1d1f]/80">{chunk.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      
      {/* FLOATING COMMAND BAR */}
      {/* FIXED at the bottom, perfectly aligned over the main right area */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-black/5 bg-white/90 p-5 backdrop-blur-2xl lg:left-[420px] lg:p-8">
        <div className="mx-auto max-w-5xl">
          
          {/* Sample Prompts */}
          <div className="mb-4 hidden flex-wrap gap-3 md:flex">
            {SAMPLE_PROMPTS.map((sample, idx) => (
              <button
                key={idx}
                disabled={!selectedDocId || querying}
                onClick={() => handleAsk(sample)}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-[#8e8e93] shadow-sm transition-all hover:border-[#007aff] hover:text-[#007aff] disabled:pointer-events-none disabled:opacity-40"
              >
                {sample}
              </button>
            ))}
          </div>

          {/* Main Input Form */}
          <form onSubmit={(e) => { e.preventDefault(); handleAsk(); }} className="relative flex items-center rounded-2xl shadow-xl">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={selectedDoc ? `Ask about "${selectedDoc.title}"...` : "Select a document first..."}
              disabled={!selectedDocId || querying}
              className="h-16 w-full rounded-2xl border-2 border-transparent bg-[#f5f5f7] pl-6 pr-36 text-lg font-semibold text-[#1d1d1f] shadow-inner transition-all placeholder:text-[#8e8e93] focus:border-[#007aff] focus:bg-white focus:outline-none disabled:opacity-60"
            />
            <div className="absolute right-3">
              <button
                type="submit"
                disabled={!selectedDocId || !query.trim() || querying}
                className="flex h-12 items-center justify-center gap-2.5 rounded-xl bg-[#007aff] px-6 text-base font-bold text-white shadow-md transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
              >
                {querying ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                <span className="hidden sm:inline">{querying ? "Auditing" : "Ask"}</span>
              </button>
            </div>
          </form>

        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d1d1d6; border-radius: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #c7c7cc; }
      `}} />
    </div>
  );
}