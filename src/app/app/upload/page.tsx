"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyRedactions } from "@/lib/documents/auto-redact";
import { documentWorkflow } from "@/lib/documents/workflow";
import { createRedactedPdf } from "@/lib/documents/redacted-pdf";
import type { DocumentPage, ParsedDocument, Redaction } from "@/lib/documents/types";
import { AnalysisRequestError, requestContractAnalysis } from "@/lib/analysis/client";
import { AccountStatus } from "@/components/account-status";
import { PdfViewer } from "@/components/pdf-viewer";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AnalysisResult } from "@/lib/analysis/types";
import { FileUp, LockKeyhole, ShieldCheck, ArrowRight, Download, Sparkles, X } from "lucide-react";
import "./upload.css";

const REMEMBER_KEY = "scopeshield-remember-local-session";
const currentTimestamp = () => Date.now();
const BTN = "inline-flex min-h-11 items-center gap-2 rounded-lg border border-ink/20 bg-white px-4 text-sm hover:bg-ivory disabled:opacity-40";
const PRIMARY = "inline-flex min-h-11 items-center gap-2 rounded-lg border border-ink bg-ink px-4 text-sm font-medium text-white hover:bg-ink-light disabled:opacity-40";
const KIND_LABEL: Record<string, string> = {
  email: "Email", "possible phone number": "Phone", "labeled account or ID number": "ID", "possible street address": "Address",
  "possible signature name": "Signature", "possible person or organization": "Name", manual: "Added",
};

export default function UploadPage() {
  const [document, setDocument] = useState<ParsedDocument | null>(null);
  const [pdf, setPdf] = useState<Blob | null>(null);
  const [rules, setRules] = useState<Redaction[]>([]);
  const [value, setValue] = useState("");
  const [sourceView, setSourceView] = useState<"pdf" | "text" | "sent">("pdf");
  const [rememberSession, setRememberSession] = useState(false);
  const [approved, setApproved] = useState(false);
  const [reviewedOcrPages, setReviewedOcrPages] = useState<number[]>([]);
  const [pdfExportApproved, setPdfExportApproved] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const sourceUrl = useMemo(() => pdf ? URL.createObjectURL(pdf) : null, [pdf]);
  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [analysisErrorCode, setAnalysisErrorCode] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const work = useRef<HTMLDivElement>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const [dialog, setDialog] = useState<"export" | "analyze" | null>(null);
  const [note, setNote] = useState("");
  const abort = useRef<AbortController | null>(null);
  const analysisAbort = useRef<AbortController | null>(null);
  const nextId = useRef(1);

  function invalidateAnalysis() {
    analysisAbort.current?.abort(); analysisAbort.current = null;
    setAnalyzing(false); setApproved(false); setAnalysis(null); setPdfExportApproved(false);
  }

  useEffect(() => {
    let active = true;
    const optedIn = localStorage.getItem(REMEMBER_KEY) === "true";
    void Promise.resolve().then(() => { if (active) setRememberSession(optedIn); });
    if (optedIn) {
      void documentWorkflow.restore(optedIn).then((session) => {
        if (!active || !session) return;
        setSourceView(session.document.pages.some((page) => page.source === "ocr") ? "text" : "pdf");
        setDocument(session.document);
        setPdf(session.pdf);
        setRules(session.redactions);
        setAnalysis(session.analysis ?? null);
        nextId.current = session.redactions.length + 1;
        setStatus("Your saved session was restored from this browser.");
      }).catch(() => { if (active) setError("Could not read the saved session from this browser."); });
    }
    return () => { active = false; abort.current?.abort(); analysisAbort.current?.abort(); };
  }, []);

  const hasDocument = document !== null;
  useEffect(() => {
    if (!hasDocument) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    work.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [hasDocument]);

  const clearSession = useCallback(async () => {
    abort.current?.abort(); abort.current = null;
    analysisAbort.current?.abort(); analysisAbort.current = null;
    localStorage.removeItem(REMEMBER_KEY);
    setRememberSession(false);
    setApproved(false); setAnalysis(null); setAnalyzing(false); setReviewedOcrPages([]); setPdfExportApproved(false);
    setDocument(null); setPdf(null); setRules([]); setValue(""); setStatus(""); setError(""); setAnalysisErrorCode("");
    nextId.current = 1;
    if (input.current) input.current.value = "";
    setStatus("Clearing local session…");
    try { await documentWorkflow.clear(); setStatus("Session cleared."); }
    catch { setError("The in-memory session was cleared, but the browser could not remove its saved copy."); setStatus(""); }
  }, []);

  async function openFile(file?: File) {
    if (!file) return;
    abort.current?.abort();
    const controller = new AbortController(); abort.current = controller;
    analysisAbort.current?.abort(); analysisAbort.current = null;
    setApproved(false); setAnalysis(null); setAnalyzing(false); setReviewedOcrPages([]); setPdfExportApproved(false);
    setDocument(null); setPdf(null); setRules([]); setError(""); setAnalysisErrorCode("");
    if (input.current) input.current.value = "";
    setStatus("Preparing your PDF on this device…");
    try {
      const prepared = await documentWorkflow.prepare(file, setStatus, controller.signal);
      if (controller.signal.aborted) return;
      nextId.current = prepared.redactions.length + 1;
      setSourceView(prepared.document.pages.some((page) => page.source === "ocr") ? "text" : "pdf");
      setDocument(prepared.document); setPdf(prepared.pdf); setRules(prepared.redactions); setStatus("");
      await documentWorkflow.persist(rememberSession, prepared);
    } catch (err) {
      if (!controller.signal.aborted) { setError(err instanceof Error ? err.message : "Could not read this PDF."); setStatus(""); }
    }
  }

  async function updateRules(next: Redaction[]) {
    setRules(next); invalidateAnalysis();
    if (rememberSession && document && pdf) {
      try { await documentWorkflow.persist(true, { document, redactions: next, pdf }); }
      catch { setError("This browser could not save your session. Your current work is still available until you leave this page."); }
    }
  }

  async function toggleRemember(checked: boolean) {
    setRememberSession(checked);
    localStorage.setItem(REMEMBER_KEY, String(checked));
    if (!checked) { await documentWorkflow.clear(); return; }
    if (document && pdf) await documentWorkflow.persist(true, { document, redactions: rules, pdf });
  }

  /** Adds a redaction for every occurrence of `term`; returns false if it was not added. */
  function redactTerm(raw: string): boolean {
    const term = raw.trim();
    if (!term || !document) return false;
    if (rules.some((rule) => rule.value.toLowerCase() === term.toLowerCase())) { setNote(`“${term}” is already redacted.`); return false; }
    const hits = document.pages.reduce((sum, page) => sum + page.text.toLowerCase().split(term.toLowerCase()).length - 1, 0);
    if (!hits) { setError("That text wasn’t found as typed. Select a single line of the PDF, or copy the exact spelling."); return false; }
    void updateRules([...rules, { value: term, replacement: `[REDACTED_${nextId.current++}]`, kind: "manual" }]);
    setError(""); setNote(`Redacted “${term}” everywhere (${hits} match${hits === 1 ? "" : "es"}).`);
    return true;
  }

  function addRedaction() { if (redactTerm(value)) setValue(""); }

  function removeRedaction(rule: Redaction) {
    void updateRules(rules.filter((item) => item.replacement !== rule.replacement));
  }

  const outgoingText = documentWorkflow.redactedText(document, rules);
  const highlights = useMemo(() => rules.map((rule) => ({ id: rule.replacement, quote: rule.value })), [rules]);
  const counts = useMemo(() => {
    const text = (document?.pages.map((page) => page.text).join("\n") ?? "").toLowerCase();
    return Object.fromEntries(rules.map((rule) => [rule.replacement, rule.value ? text.split(rule.value.toLowerCase()).length - 1 : 0]));
  }, [document, rules]);
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (dialog && !d.open) d.showModal();
    if (!dialog && d.open) d.close();
  }, [dialog, hasDocument]);
  const hasOcr = document?.pages.some((page) => page.source === "ocr") ?? false;
  const unreviewedOcr = document?.pages.some((page) => page.source === "ocr" && !reviewedOcrPages.includes(page.pageNumber)) ?? false;

  async function analyze() {
    if (!approved || !outgoingText.trim()) return;
    const controller = new AbortController(); analysisAbort.current = controller;
    setAnalyzing(true); setAnalysis(null); setError(""); setAnalysisErrorCode("");
    try {
      const result = await requestContractAnalysis(outgoingText, controller.signal);
      if (!controller.signal.aborted) {
        setAnalysis(result);
        if (document && pdf) {
          try {
            await documentWorkflow.persist(true, { document, redactions: rules, pdf, analysis: result });
            router.push("/app/analysis");
          } catch { setError("The analysis finished, but this browser could not save it, so it cannot be reopened. Allow site storage and run it again."); }
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "Analysis failed.");
        if (err instanceof AnalysisRequestError) setAnalysisErrorCode(err.code ?? "");
      }
    } finally { if (!controller.signal.aborted) setAnalyzing(false); }
  }

  async function downloadRedactedPdf() {
    if (!document || !pdfExportApproved || unreviewedOcr || exportingPdf) return;
    setExportingPdf(true); setError(""); setAnalysisErrorCode("");
    try {
      const bytes = await createRedactedPdf(document, rules);
      const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" }));
      const link = window.document.createElement("a");
      link.href = url; link.download = "scopeshield-redacted.pdf"; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the redacted PDF.");
    } finally { setExportingPdf(false); }
  }

  function editOcrPage(pageNumber: number, text: string) {
    if (!document) return;
    const updated = { ...document, pages: document.pages.map((page) => page.pageNumber === pageNumber ? { ...page, text } : page), updatedAt: currentTimestamp() };
    setDocument(updated); setReviewedOcrPages((current) => current.filter((number) => number !== pageNumber)); invalidateAnalysis();
    if (rememberSession && pdf) void documentWorkflow.persist(true, { document: updated, redactions: rules, pdf })
      .catch(() => setError("Could not save the corrected OCR text in this browser."));
  }

  function renderPages(pages: DocumentPage[], redacted: boolean) {
    return pages.map((page) => <article key={page.pageNumber} className="mb-4 min-w-0 rounded-xl border bg-white p-5 last:mb-0">
      <h3 className="mb-3 text-xs">Page {page.pageNumber} · {page.source === "ocr" ? `Local OCR · ${Math.round(page.ocrConfidence ?? 0)}% confidence` : "PDF text"}</h3>
      {page.source === "ocr" && !redacted
        ? <div className="text-sm"><label className="block">Review and correct OCR text against the original PDF
            <textarea value={page.text} onChange={(event) => editOcrPage(page.pageNumber, event.target.value)} className="mt-2 min-h-48 w-full rounded-lg border p-3 leading-relaxed" />
          </label><label className="mt-2 flex gap-2"><input type="checkbox" checked={reviewedOcrPages.includes(page.pageNumber)} onChange={(event) => {
            setReviewedOcrPages((current) => event.target.checked ? [...current, page.pageNumber] : current.filter((number) => number !== page.pageNumber));
            invalidateAnalysis();
          }} />I checked this page against the original PDF.</label></div>
        : <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-sm leading-relaxed">{redacted ? applyRedactions(page.text, rules) : page.text}</p>}
    </article>);
  }

  return (
    <div className={`${"ss-upload-workspace"} mx-auto w-full max-w-[1600px] p-4 md:p-8`}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-light">Free · Local document redaction</p><h1 className="font-serif text-3xl sm:text-4xl">Prepare your contract privately</h1></div>
        <div className="flex flex-wrap items-center gap-3"><AccountStatus /><button className="rounded-lg border px-4 py-2" onClick={() => void clearSession()}>Clear session</button></div>
      </div>
      {!document && <p className="mb-6 max-w-4xl text-sm leading-relaxed text-ink-light">PDF text and OCR run in your browser. Your original PDF and redaction mapping stay on this device. Only text you explicitly approve is sent for optional analysis. Review automatic redaction suggestions carefully. Work stays in memory unless you choose to save it on this device. After an analysis, the PDF, redactions, and findings are saved in this browser for seven days so you can reopen the results; you can delete them at any time.</p>}
      {!document && <ol aria-label="Document workflow" className={"ss-upload-steps"}>
        <li aria-current={!document ? "step" : undefined}><span>01</span><div><strong>Prepare</strong><small>Choose your PDF</small></div></li>
        <li aria-current={document && !analysis ? "step" : undefined}><span>02</span><div><strong>Review</strong><small>Check every redaction</small></div></li>
        <li aria-current={analysis ? "step" : undefined}><span>03</span><div><strong>Use your text</strong><small>Export or analyze</small></div></li>
      </ol>}
      <label className={`${"ss-upload-dropzone"} ${document ? "ss-upload-compact" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void openFile(event.dataTransfer.files[0]); }}>
        <span className={"ss-upload-uploadIcon"}><FileUp aria-hidden="true" size={24} /></span>
        {!document && <><span className="mb-2 block font-serif text-2xl">Choose or drop a PDF</span>
        <span className="mb-5 block text-sm text-ink-light">Start with the contract you want to review.</span></>}
        <input ref={input} type="file" accept="application/pdf,.pdf" onChange={(event) => void openFile(event.target.files?.[0])} aria-label="Choose a PDF" className={"ss-upload-fileInput"} />
        {!document && <span className="mt-3 block text-xs text-ink-light">Up to 25 MB. Scanned pages are processed locally with English OCR.</span>}
      </label>
      {!document && <div className={"ss-upload-privacyNote"}><LockKeyhole aria-hidden="true" size={18} /><p><strong>Local preparation. Sharing by choice.</strong><span>Your original PDF stays on this device. Review the extracted text before exporting or choosing optional AI analysis.</span></p></div>}
      <label className={`${"ss-upload-remember"} ${document ? "mb-3" : "mb-6"} flex items-start gap-3 text-sm`}><input type="checkbox" checked={rememberSession} onChange={(event) => void toggleRemember(event.target.checked)} className="mt-1" />
        <span><strong>Remember this session on this device</strong><span className="block text-ink-light">Saves this PDF and your work in this browser. It expires after seven days of inactivity. Avoid enabling this on a shared device.</span></span>
      </label>
      <p role="status" aria-live="polite" className={status ? "ss-upload-status" : undefined}>{status}</p>
      {error && <p role="alert" className="mb-4 rounded-lg bg-amber p-4 text-sm">{error}</p>}
      {analysisErrorCode === "no_credits" && <p className="mb-4 text-sm"><Link href="/pricing" className="underline">Buy an analysis credit</Link> to continue.</p>}
      {analysisErrorCode === "unauthenticated" && <p className="mb-4 text-sm"><Link href="/login?next=%2Fapp%2Fupload" className="underline">Sign in</Link> to use your analysis credits.</p>}
      {!document && <section aria-labelledby="before-title" className={"ss-upload-before"}><h2 id="before-title" className="font-serif text-2xl">A little preparation goes a long way.</h2><div><p><span>01</span><strong>Have your PDF ready</strong>Text PDFs and scanned pages are supported. Scanned pages need an extra OCR review.</p><p><span>02</span><strong>Decide what stays private</strong>Review names, contact details, and any other sensitive values before sharing.</p><p><span>03</span><strong>Choose what comes next</strong>Download a redacted text-only PDF, or approve the text for optional analysis.</p></div><Link href="/pricing" className="inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4">About analysis credits<ArrowRight aria-hidden="true" size={15} /></Link></section>}
      {document && <>
        <div ref={work} className="mb-3 flex scroll-mt-20 flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><h2 className="[overflow-wrap:anywhere] font-medium">{document.name} · {document.pages.length} pages</h2>
        {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-2 text-sm underline underline-offset-4">Open the original PDF in a new tab</a>}</div>
        <div role="toolbar" aria-label="Document actions" className="sticky top-[4.4rem] z-30 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white/95 px-4 py-2 backdrop-blur-sm">
          <p className="text-sm text-ink-light">{rules.length} redaction{rules.length === 1 ? "" : "s"}{unreviewedOcr ? " · review scanned pages in “Original text” first" : ""}</p>
          <div className="flex flex-wrap items-center gap-2">
            {analysis && <Link href="/app/analysis" className="text-sm underline underline-offset-4">View {analysis.findings.length} finding{analysis.findings.length === 1 ? "" : "s"}</Link>}
            <button type="button" disabled={unreviewedOcr || exportingPdf} onClick={() => setDialog("export")} className={BTN}><Download aria-hidden="true" size={16} />{exportingPdf ? "Building PDF…" : "Export PDF"}</button>
            <button type="button" disabled={unreviewedOcr || analyzing} onClick={() => setDialog("analyze")} className={PRIMARY}><Sparkles aria-hidden="true" size={16} />{analyzing ? "Analyzing…" : "Analyze with AI"}</button>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 md:items-start">
          <section aria-label="Document review" className="flex min-w-0 flex-col gap-3 rounded-xl border bg-white p-4 md:sticky md:top-[8.75rem] md:h-[calc(100dvh-9.75rem)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck aria-hidden="true" size={17} />{sourceView === "pdf" ? "Redacted PDF" : sourceView === "text" ? "Extracted text" : "Exact text to be sent"}</h2>
              <div className="flex gap-1 rounded-lg border p-1" role="group" aria-label="Document view">
                <button type="button" aria-pressed={sourceView === "pdf"} onClick={() => setSourceView("pdf")} className={`rounded-md px-3 py-2 text-sm ${sourceView === "pdf" ? "bg-ink text-white" : ""}`}>Redacted PDF</button>
                <button type="button" aria-pressed={sourceView === "text"} onClick={() => setSourceView("text")} className={`rounded-md px-3 py-2 text-sm ${sourceView === "text" ? "bg-ink text-white" : ""}`}>Original text</button>
                <button type="button" aria-pressed={sourceView === "sent"} onClick={() => setSourceView("sent")} className={`rounded-md px-3 py-2 text-sm ${sourceView === "sent" ? "bg-ink text-white" : ""}`}>Text to be sent</button>
              </div>
            </div>
            {sourceView === "pdf" && <>
              {hasOcr && <p className="rounded-lg bg-amber p-3 text-sm">Scanned pages can’t show black boxes. Review and correct them in <strong>Original text</strong>, and check what will be sent in <strong>Text to be sent</strong>.</p>}
              <div role="region" aria-label="Redacted PDF preview" tabIndex={0} className="h-[70dvh] min-h-0 overflow-auto rounded-lg bg-alabaster p-2 md:h-auto md:flex-1">
                {pdf && <PdfViewer pdf={pdf} highlights={highlights} mode="redact" onSelectText={redactTerm} />}
              </div>
              <p className="text-xs text-ink-light"><strong>Select text in the PDF to redact it everywhere</strong> (drag, or double-click a word). Black boxes are a visual aid; the exact text sent is under “Text to be sent”.</p>
            </>}
            {sourceView === "text" && <div role="region" aria-label="Original document pages" tabIndex={0} className="h-[70dvh] overflow-auto rounded-lg bg-alabaster p-2 md:h-auto md:flex-1">{renderPages(document.pages, false)}</div>}
            {sourceView === "sent" && <div role="region" aria-label="Redacted document pages" tabIndex={0} className="h-[70dvh] overflow-auto rounded-lg bg-sage p-2 md:h-auto md:flex-1">{renderPages(document.pages, true)}</div>}
          </section>
          <section aria-label="Manage redactions" className="min-w-0 rounded-xl border bg-white p-4 md:p-5">
            <h2 className="mb-1 flex flex-wrap items-center gap-3 font-semibold">Redactions <span className={"ss-upload-count"}>{rules.length} active</span></h2>
            <p className="mb-3 text-sm text-ink-light">Select text in the PDF, or type it below. Every match is redacted, ignoring letter case. Check the suggestions: automatic detection can miss details or flag ordinary words.</p>
            <form className="mb-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); addRedaction(); }}>
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">Text to redact everywhere<input value={value} onChange={(event) => setValue(event.target.value)} className="min-h-11 rounded-lg border bg-white px-3" placeholder="Enter a sensitive value" /></label>
              <button disabled={!value.trim()} className="self-end rounded-lg bg-ink px-5 text-white disabled:opacity-40">Add redaction</button>
            </form>
            <p role="status" aria-live="polite" className="mb-2 min-h-5 text-sm text-ink-light">{note}</p>
            {rules.length === 0 && <p className="rounded-lg bg-alabaster p-3 text-sm text-ink-light">Nothing is redacted yet.</p>}
            <ul aria-label="Active redactions" className="flex max-h-[45dvh] flex-wrap gap-2 overflow-auto">
              {rules.map((rule) => (
                <li key={rule.replacement} className="inline-flex max-w-full items-center gap-2 rounded-full border bg-ivory py-0.5 pl-3 pr-0.5 text-sm">
                  <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-ink-light">{KIND_LABEL[rule.kind ?? "manual"] ?? "Name"}</span>
                  <span className="min-w-0 max-w-[14rem] truncate" title={rule.value}>{rule.value}</span>
                  {counts[rule.replacement] > 1 && <span className="shrink-0 text-xs text-ink-light">×{counts[rule.replacement]}</span>}
                  <button type="button" onClick={() => removeRedaction(rule)} aria-label={`Undo redaction of ${rule.value}`} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-terracotta"><X aria-hidden="true" size={14} /></button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-light">OCR text should be checked against the original PDF.</p>
          </section>
        </div>
        <dialog ref={dlg} aria-labelledby="dlg-title" onClose={() => setDialog(null)} onClick={(event) => { if (event.target === event.currentTarget) setDialog(null); }}
          className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-2xl border bg-white p-6 text-ink backdrop:bg-ink/40">
          {dialog === "export" && <>
            <p className={"ss-upload-eyebrow"}>Free · Local export</p><h2 id="dlg-title" className="font-serif text-2xl">Download a redacted PDF</h2>
            <p className="my-2 text-sm text-ink-light">This creates a fresh text-only PDF from the reviewed redacted text. It does not copy the source PDF, its images, hidden content, filename, or metadata. Page layout and images are not preserved.</p>
            {unreviewedOcr && <p className="my-3 rounded-lg bg-amber p-3 text-sm">Review and confirm each OCR page before exporting.</p>}
            <label className="my-4 flex gap-3 rounded-lg bg-alabaster p-3 text-sm"><input type="checkbox" checked={pdfExportApproved} disabled={unreviewedOcr} onChange={(event) => setPdfExportApproved(event.target.checked)} /><span>I reviewed the redacted text above and approve creating this PDF.</span></label>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setDialog(null)} className={BTN}>Cancel</button>
              <button type="button" disabled={!pdfExportApproved || unreviewedOcr || exportingPdf} onClick={() => { setDialog(null); void downloadRedactedPdf(); }} className={PRIMARY}>{exportingPdf ? "Building PDF…" : "Download redacted PDF"}</button></div>
          </>}
          {dialog === "analyze" && <>
            <p className={"ss-upload-eyebrow"}>Optional · Uses an analysis credit</p><h2 id="dlg-title" className="font-serif text-2xl">Optional contract analysis</h2>
            <p className="my-2 text-sm text-ink-light">The original PDF, filename, and redaction mapping stay in this browser. If you continue, only the redacted text is sent to ScopeShield and OpenAI. OpenAI API data may be retained for abuse monitoring for up to 30 days under the default controls. The result is saved on this device for seven days so you can reopen it; you can delete it at any time.</p>
            {unreviewedOcr && <p className="my-3 rounded-lg bg-amber p-3 text-sm">Review and confirm each OCR page before analysis.</p>}
            <label className="my-4 flex gap-3 rounded-lg bg-alabaster p-3 text-sm"><input type="checkbox" checked={approved} disabled={unreviewedOcr} onChange={(event) => setApproved(event.target.checked)} /><span>I reviewed the exact text above and approve sending it for analysis.</span></label>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setDialog(null)} className={BTN}>Cancel</button>
              <button type="button" disabled={!approved || unreviewedOcr || analyzing} onClick={() => { setDialog(null); void analyze(); }} className={PRIMARY}>{analyzing ? "Analyzing…" : "Analyze redacted text"}</button></div>
          </>}
        </dialog>
      </>}
    </div>
  );
}
