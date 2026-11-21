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
    // HYBRID WRAPPER: Normal scroll on Mobile, Locked Edge-to-Edge on Desktop (lg:)
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1d1d1f] selection:bg-[#007aff] selection:text-white lg:h-screen lg:overflow-hidden">
      
      {/* TOP NAVIGATION BAR: Sticky on Mobile, Static on Desktop */}
      <header className="sticky top-0 z-50 flex h-[60px] shrink-0 items-center justify-between border-b border-black/5 bg-[#f5f5f7]/95 px-4 backdrop-blur-md lg:static lg:bg-[#f5f5f7] lg:px-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 shrink-0 text-[#007aff]" />
          <h1 className="text-base font-semibold tracking-wide text-[#1d1d1f]">
            VeriRAG <span className="hidden font-normal text-[#8e8e93] sm:inline">Evaluated Document Assistant</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={activateGuestDemo}
            disabled={documents.length === 0 || querying}
            className="inline-flex items-center gap-2 rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-50 lg:px-5"
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Try Instant Guest Demo</span>
            <span className="sm:hidden">Guest Demo</span>
          </button>
        </div>
      </header>

      {/* MAIN SPLIT-PANE WORKSPACE */}
      <div className="flex flex-1 flex-col lg:flex-row lg:overflow-hidden">
        
        {/* LEFT SIDEBAR: KNOWLEDGE BASE */}
        <aside className="flex flex-col border-b border-black/5 bg-[#f5f5f7] shadow-[0_1px_10px_rgba(0,0,0,0.02)] lg:w-[420px] lg:shrink-0 lg:border-b-0 lg:border-r lg:shadow-[1px_0_10px_rgba(0,0,0,0.02)] lg:overflow-hidden">
          
          {/* Section 1: Upload */}
          <div className="border-b border-black/5 p-4 lg:p-6 lg:shrink-0">
            <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#8e8e93] lg:text-xs">
              <Database className="h-4 w-4 text-[#007aff]" />
              Index a PDF Document
            </h2>

            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#c7c7cc] bg-white p-4 transition-all hover:border-[#007aff] hover:bg-[#f0f9ff] lg:p-6">
              {uploading ? (
                <div className="flex flex-col items-center gap-3 text-[#007aff]">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-sm font-medium">Generating embeddings...</span>
                </div>
              ) : (
                <>
                  <Upload className="mb-2 h-5 w-5 text-[#8e8e93] lg:mb-3 lg:h-6 lg:w-6" />
                  <span className="text-sm font-semibold text-[#1d1d1f] lg:text-base">Upload PDF File</span>
                  <span className="mt-1 text-[11px] font-medium text-[#8e8e93] lg:text-xs">Max 15 MB</span>
                </>
              )}
              <input type="file" accept=".pdf,application/pdf" onChange={handleFileUpload} disabled={uploading} className="hidden" />
            </label>

            <label className="mt-3 flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-[#8e8e93] transition hover:text-[#1d1d1f] lg:text-sm">
              <input type="checkbox" checked={markAsDemo} onChange={(e) => setMarkAsDemo(e.target.checked)} className="h-4 w-4 rounded border-[#c7c7cc] text-[#007aff] focus:ring-[#007aff]" />
              Pin as pre-loaded Guest Demo
            </label>
          </div>

          {/* Section 2: Document List */}
          <div className="flex flex-col p-4 lg:flex-1 lg:overflow-hidden lg:p-6">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#8e8e93] lg:text-xs">
              Active Documents ({documents.length})
            </h2>

            {loadingDocs ? (
              <div className="flex items-center gap-2 text-sm font-medium text-[#8e8e93]">
                <Loader2 className="h-5 w-5 animate-spin" /> Syncing...
              </div>
            ) : documents.length === 0 ? (
              <div className="rounded-xl border border-black/5 bg-white p-5 text-center text-sm font-medium text-[#8e8e93] shadow-sm">
                No documents indexed. Upload a PDF to begin.
              </div>
            ) : (
              // MOBILE FIX: max-h-[30vh] limits list height on phones, while lg:max-h-none fills sidebar on desktop
              <div className="custom-scrollbar space-y-3 overflow-y-auto pr-2 max-h-[30vh] lg:max-h-none lg:flex-1 lg:pr-3">
                {documents.map((doc) => {
                  const active = doc.id === selectedDocId;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => { setSelectedDocId(doc.id); setResponse(null); }}
                      className={`group flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3.5 transition-all lg:p-4 ${
                        active ? "border-[#007aff] bg-white shadow-[0_2px_12px_rgba(0,122,255,0.12)]" : "border-black/5 bg-white hover:border-[#c7c7cc]"
                      }`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg lg:h-8 lg:w-8 ${active ? "bg-[#007aff]/10" : "bg-[#f2f2f7]"}`}>
                          <FileText className={`h-4 w-4 lg:h-5 lg:w-5 ${active ? "text-[#007aff]" : "text-[#8e8e93]"}`} />
                        </div>
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-semibold lg:text-base ${active ? "text-[#1d1d1f]" : "text-[#1d1d1f]/80"}`}>{doc.title}</p>
                          <div className="mt-1 flex items-center gap-2 lg:mt-1.5">
                            <span className="text-[11px] font-medium text-[#8e8e93] lg:text-xs">{doc.page_count} {doc.page_count === 1 ? "page" : "pages"}</span>
                            {doc.is_demo && <span className="rounded bg-[#34c759]/10 px-2 py-0.5 text-[9px] font-bold text-[#34c759] lg:text-[10px]">DEMO</span>}
                          </div>
                        </div>
                      </div>
                      <button onClick={(e) => handleDeleteDoc(doc.id, e)} className="rounded p-1.5 text-[#8e8e93] opacity-100 transition-opacity hover:bg-[#ff3b30]/10 hover:text-[#ff3b30] lg:opacity-0 lg:group-hover:opacity-100">
                        <Trash2 className="h-4 w-4 lg:h-5 lg:w-5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT MAIN AREA */}
        <main className="relative flex flex-1 flex-col bg-white min-w-0 lg:overflow-hidden">
          
          {/* Scrollable Results Area */}
          <div className="custom-scrollbar flex-1 p-4 pb-32 lg:overflow-y-auto lg:p-12 lg:pb-48">
            <div className="mx-auto w-full max-w-5xl space-y-6 lg:space-y-8">
              
              {errorMsg && (
                <div className="flex items-center gap-3 rounded-xl border border-[#ff3b30]/20 bg-[#ff3b30]/5 p-4 text-sm font-medium text-[#ff3b30] lg:p-5 lg:text-base">
                  <AlertTriangle className="h-5 w-5 shrink-0 lg:h-6 lg:w-6" />
                  {errorMsg}
                </div>
              )}

              {!response && !querying && !errorMsg && (
                <div className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-[#c7c7cc] bg-[#f5f5f7]/50 px-4 py-16 text-center lg:px-6 lg:py-24">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-black/5 bg-white shadow-sm lg:mb-6 lg:h-20 lg:w-20">
                    <ShieldCheck className="h-8 w-8 text-[#007aff] lg:h-10 lg:w-10" />
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-[#1d1d1f] lg:text-2xl">VeriRAG Engine Ready</h3>
                  <p className="mt-2 max-w-lg text-sm text-[#8e8e93] lg:mt-3 lg:text-base">
                    Select a document and ask a question below. The engine uses Hybrid Vector + RRF Search, generates inline citations, and audits every factual claim via NLI.
                  </p>
                </div>
              )}

              {querying && (
                <div className="flex flex-col items-center justify-center py-16 text-[#007aff] lg:py-24">
                  <Loader2 className="mb-4 h-8 w-8 animate-spin lg:mb-5 lg:h-10 lg:w-10" />
                  <p className="text-sm font-semibold lg:text-base">Retrieving context & auditing response...</p>
                </div>
              )}

              {response && !querying && (
                <div className="duration-500 animate-in fade-in slide-in-from-bottom-4 space-y-6 lg:space-y-8">
                  
                  {/* Apple Bento Box Metrics Row */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-5">
                    <div className={`flex flex-col justify-between rounded-3xl border border-black/5 p-5 shadow-sm lg:rounded-[2rem] lg:p-6 ${scorePct >= 85 ? "bg-[#34c759]/5" : "bg-[#ff9500]/5"}`}>
                      <div className="mb-3 flex items-center justify-between lg:mb-4">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#8e8e93] lg:text-xs">Faithfulness Judge</span>
                        {scorePct >= 85 ? <CheckCircle2 className="h-4 w-4 text-[#34c759] lg:h-5 lg:w-5" /> : <AlertTriangle className="h-4 w-4 text-[#ff9500] lg:h-5 lg:w-5" />}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-bold tracking-tighter lg:text-5xl ${scorePct >= 85 ? "text-[#34c759]" : "text-[#ff9500]"}`}>{scorePct}%</span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-[#8e8e93] lg:mt-2 lg:text-sm">
                        {response.evaluation.supported_claims} of {response.evaluation.total_claims} claims verified
                      </p>
                    </div>

                    <div className="flex flex-col justify-between rounded-3xl border border-black/5 bg-white p-5 shadow-sm lg:rounded-[2rem] lg:p-6">
                      <div className="mb-3 flex items-center justify-between lg:mb-4">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#8e8e93] lg:text-xs">Pipeline Latency</span>
                        <Clock className="h-4 w-4 text-[#007aff] lg:h-5 lg:w-5" />
                      </div>
                      <p className="text-4xl font-bold tracking-tighter text-[#1d1d1f] lg:text-5xl">{(response.metrics.total_ms / 1000).toFixed(2)}s</p>
                      <p className="mt-1 truncate text-xs font-medium text-[#8e8e93] lg:mt-2 lg:text-sm">
                        Search: {response.metrics.retrieval_ms}ms • Gen: {response.metrics.generation_ms}ms
                      </p>
                    </div>

                    <div className="flex flex-col justify-between rounded-3xl border border-black/5 bg-white p-5 shadow-sm lg:rounded-[2rem] lg:p-6">
                      <div className="mb-3 flex items-center justify-between lg:mb-4">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#8e8e93] lg:text-xs">Grounding Status</span>
                        <Info className="h-4 w-4 text-[#1d1d1f]/40 lg:h-5 lg:w-5" />
                      </div>
                      <p className={`text-xl font-bold tracking-tight lg:text-2xl ${response.is_answerable ? "text-[#1d1d1f]" : "text-[#ff9500]"}`}>
                        {response.is_answerable ? "Grounded in Context" : "Safe Refusal (Out of Scope)"}
                      </p>
                      <p className="mt-1 truncate text-xs font-medium text-[#8e8e93] lg:mt-2 lg:text-sm">{response.metrics.model_used}</p>
                    </div>
                  </div>

                  {/* Main Answer Card */}
                  <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm sm:p-10 lg:rounded-[2rem] lg:p-8">
                    <h3 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[#007aff] lg:mb-5 lg:text-xs">Verified Answer</h3>
                    <div className="prose prose-sm max-w-none whitespace-pre-line font-medium leading-relaxed text-[#1d1d1f] md:prose-base lg:prose-lg">
                      {response.answer}
                    </div>
                    <div className="mt-6 rounded-xl bg-[#f5f5f7] p-4 text-sm font-semibold text-[#1d1d1f] lg:mt-8 lg:p-5 lg:text-base">
                      <span className="mr-2 text-[#8e8e93]">Audit Verdict:</span> {response.evaluation.verdict}
                    </div>
                  </div>

                  {/* Inline Citations */}
                  {response.citations.length > 0 && (
                    <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm lg:rounded-[2rem] lg:p-8">
                      <h3 className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#8e8e93] lg:mb-5 lg:text-xs">
                        <BookOpen className="h-4 w-4 text-[#007aff] lg:h-5 lg:w-5" /> Supporting Evidence Citations
                      </h3>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-5">
                        {response.citations.map((cit, i) => (
                          <div key={i} className="rounded-xl border border-black/5 bg-[#f9f9f9] p-4 lg:p-5">
                            <div className="mb-2 flex items-center justify-between lg:mb-3">
                              <span className="rounded-md bg-[#007aff]/10 px-2 py-1 text-[10px] font-bold text-[#007aff] lg:px-2.5 lg:text-xs">PAGE {cit.page_number}</span>
                              <span className="text-[10px] font-bold text-[#8e8e93] lg:text-xs">CHUNK #{cit.chunk_index}</span>
                            </div>
                            <p className="text-sm font-medium italic leading-relaxed text-[#1d1d1f]/80 lg:text-base">&ldquo;{cit.quote}&rdquo;</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Raw Hybrid Search Chunks */}
                  <div className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm lg:rounded-[2rem]">
                    <button
                      onClick={() => setShowRawChunks(!showRawChunks)}
                      className="flex w-full items-center justify-between bg-white px-6 py-4 text-sm font-bold text-[#1d1d1f] transition-colors hover:bg-[#f5f5f7] lg:px-8 lg:py-5 lg:text-base"
                    >
                      <span className="text-left">Inspect Top-{response.retrieved_chunks.length} Search Chunks (Vector + RRF)</span>
                      {showRawChunks ? <ChevronUp className="h-5 w-5 shrink-0 text-[#8e8e93] lg:h-6 lg:w-6" /> : <ChevronDown className="h-5 w-5 shrink-0 text-[#8e8e93] lg:h-6 lg:w-6" />}
                    </button>
                    {showRawChunks && (
                      <div className="space-y-4 border-t border-black/5 bg-[#f9f9f9] p-6 lg:space-y-5 lg:p-8">
                        {response.retrieved_chunks.map((chunk) => (
                          <div key={chunk.chunk_id} className="rounded-xl border border-black/5 bg-white p-4 lg:p-5">
                            <div className="mb-2 flex items-center justify-between lg:mb-3">
                              <span className="text-xs font-bold text-[#1d1d1f] lg:text-sm">Page {chunk.page_number} <span className="font-normal text-[#8e8e93]">/ Chunk #{chunk.chunk_index}</span></span>
                              <span className="font-mono text-xs font-bold text-[#34c759] lg:text-sm">RRF: {chunk.rrf_score.toFixed(4)}</span>
                            </div>
                            <p className="whitespace-pre-line text-sm font-medium leading-relaxed text-[#1d1d1f]/80 lg:text-base">{chunk.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                </div>
              )}
            </div>
          </div>

          {/* FLOATING COMMAND BAR */}
          {/* MOBILE FIX: fixed to bottom of screen, Desktop lg:absolute to bottom of workspace */}
          <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-black/5 bg-white/90 p-4 backdrop-blur-2xl lg:absolute lg:p-8">
            <div className="mx-auto max-w-5xl">
              
              {/* Sample Prompts */}
              <div className="mb-3 hidden flex-wrap gap-2 md:flex lg:mb-4 lg:gap-3">
                {SAMPLE_PROMPTS.map((sample, idx) => (
                  <button
                    key={idx}
                    disabled={!selectedDocId || querying}
                    onClick={() => handleAsk(sample)}
                    className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#8e8e93] shadow-sm transition-all hover:border-[#007aff] hover:text-[#007aff] disabled:pointer-events-none disabled:opacity-40 lg:px-4 lg:py-2 lg:text-xs"
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
                  placeholder={selectedDoc ? `Ask about "${selectedDoc.title}"...` : "Select a document..."}
                  disabled={!selectedDocId || querying}
                  className="h-14 w-full rounded-2xl border-2 border-transparent bg-[#f5f5f7] pl-5 pr-28 text-base font-semibold text-[#1d1d1f] shadow-inner transition-all placeholder:text-[#8e8e93] focus:border-[#007aff] focus:bg-white focus:outline-none disabled:opacity-60 lg:h-16 lg:pl-6 lg:pr-36 lg:text-lg"
                />
                <div className="absolute right-2 lg:right-3">
                  <button
                    type="submit"
                    disabled={!selectedDocId || !query.trim() || querying}
                    className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#007aff] px-4 text-sm font-bold text-white shadow-md transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-40 lg:h-12 lg:gap-2.5 lg:px-6 lg:text-base"
                  >
                    {querying ? <Loader2 className="h-4 w-4 animate-spin lg:h-5 lg:w-5" /> : <Send className="h-4 w-4 lg:h-5 lg:w-5" />}
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