"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleCheck, Copy, Download, OctagonAlert, Trash2, TriangleAlert } from "lucide-react";
import { documentWorkflow } from "@/lib/documents/workflow";
import type { DocumentSession } from "@/lib/documents/types";
import { createFindingsPdf } from "@/lib/analysis/findings-pdf";
import { unredact } from "@/lib/analysis/locate";
import { TRAPS, type Tone } from "@/lib/analysis/types";
import { PdfViewer, type Active } from "@/components/pdf-viewer";

const TONES: Tone[] = ["soft", "balanced", "firm"];
const PANE = "h-[70dvh] overflow-auto rounded-xl border border-ink/15 min-[400px]:h-[max(28rem,calc(100dvh-15.5rem))]";
const BTN = "inline-flex min-h-11 items-center gap-2 rounded-lg border border-ink/20 bg-white px-4 text-sm hover:bg-ivory focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink";
const PRIMARY = "inline-flex min-h-11 items-center gap-2 rounded-lg border border-ink bg-ink px-4 text-sm font-medium text-white hover:bg-ink-light focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink";

export default function AnalysisPage() {
  const router = useRouter();
  const [session, setSession] = useState<DocumentSession | null | undefined>(undefined);
  const [resolved, setResolved] = useState<string[]>([]);
  const [active, setActive] = useState<Active>(null);
  const [located, setLocated] = useState<string[] | null>(null);
  const [tone, setTone] = useState(1);
  const [step, setStep] = useState<"findings" | "email">("findings");
  const pane = useRef<HTMLElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let on = true;
    documentWorkflow.restore(true).then((s) => {
      if (!on) return;
      setSession(s?.analysis ? s : null);
      setResolved(s?.analysis?.findings.filter((f) => f.resolved).map((f) => f.id) ?? []);
    }).catch(() => { if (on) setSession(null); });
    return () => { on = false; };
  }, []);

  const analysis = session?.analysis;
  const redactions = useMemo(() => session?.redactions ?? [], [session]);
  const findings = useMemo(() => analysis?.findings ?? [], [analysis]);
  const highlights = useMemo(() => findings.map((f) => ({ id: f.id, severity: f.severity, quote: unredact(f.quote, redactions) })), [findings, redactions]);

  if (session === undefined) return <p role="status" className="p-8 text-sm">Loading your analysis…</p>;
  if (!session || !analysis) return (
    <div className="mx-auto max-w-xl p-8">
      <h1 className="mb-3 font-serif text-3xl">No saved analysis</h1>
      <p className="mb-6 text-sm text-ink-light">Analyses are saved only on this device and expire after seven days of inactivity. Prepare and analyze a contract to see its findings here.</p>
      <Link href="/app/upload" className={BTN}>Go to upload</Link>
    </div>
  );

  const show = (s: string) => unredact(s, redactions);
  const open = findings.filter((f) => !resolved.includes(f.id));
  const count = (s: "critical" | "warning") => open.filter((f) => f.severity === s).length;
  const email = open.length
    ? `Hi [Name],\n\nThanks for sending over the agreement. Before I sign, I'd like to align on ${open.length === 1 ? "one point" : `${open.length} points`}:\n\n${open.map((f, i) => `${i + 1}. ${TRAPS[f.trap]}\n${show(f.pushback[TONES[tone]])}`).join("\n\n")}\n\nHappy to jump on a quick call if that's easier.\n\nBest,\n[Your name]`
    : "Every flagged item is marked resolved, so there is nothing to push back on.";

  async function toggleResolved(id: string) {
    const next = resolved.includes(id) ? resolved.filter((r) => r !== id) : [...resolved, id];
    setResolved(next);
    try {
      await documentWorkflow.persist(true, { document: session!.document, pdf: session!.pdf, redactions,
        analysis: { ...analysis!, findings: findings.map((f) => ({ ...f, resolved: next.includes(f.id) })) } });
    } catch { setError("This browser could not save your change. It will be lost when you leave this page."); }
  }

  async function copyEmail() {
    try { await navigator.clipboard.writeText(email); setMessage("Email copied."); }
    catch { setMessage("Could not copy. Select the text and copy it manually."); }
  }

  async function downloadPdf() {
    try {
      const bytes = await createFindingsPdf({ ...analysis!, findings: findings.map((f) => ({ ...f, resolved: resolved.includes(f.id) })) });
      const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" }));
      const link = document.createElement("a"); link.href = url; link.download = "scopeshield-findings.pdf"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create the findings PDF."); }
  }

  async function deleteSession() {
    await documentWorkflow.clear();
    router.push("/app/upload");
  }

  const select = (id: string) => setActive({ id, n: Date.now() });
  const go = (next: "findings" | "email") => { setStep(next); pane.current?.scrollTo({ top: 0 }); };
  const TAB = "min-h-11 rounded-lg px-4 text-sm font-medium focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink";

  return (
    <div className="mx-auto w-full max-w-[1600px] p-4 md:p-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/app/upload" className="mb-2 inline-flex min-h-8 items-center gap-1 text-sm underline underline-offset-4"><ArrowLeft aria-hidden="true" size={15} />Back to redaction</Link>
          <h1 className="font-serif text-3xl">Contract analysis</h1>
          <p className="text-sm text-ink-light">{session.document.name} · saved on this device for seven days of inactivity</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void downloadPdf()} className={BTN}><Download aria-hidden="true" size={16} />Download findings PDF</button>
          <button type="button" onClick={() => void deleteSession()} className={BTN}><Trash2 aria-hidden="true" size={16} />Delete from this device</button>
        </div>
      </header>
      {error && <p role="alert" className="mb-4 rounded-lg bg-amber p-3 text-sm">{error}</p>}
      <div className="grid gap-6 min-[400px]:grid-cols-2">
        <section aria-label="Original PDF" className={`${PANE} bg-alabaster p-3`}>
          <PdfViewer pdf={session.pdf} highlights={highlights} resolved={resolved} active={active} onSelect={select} onSettled={setLocated} />
        </section>
        <section ref={pane} aria-label="Flagged findings" className={`${PANE} bg-white p-4`}>
          <div className="sticky -top-4 z-10 -mx-4 -mt-4 mb-4 border-b border-ink/10 bg-white/95 px-4 pb-3 pt-4 backdrop-blur-sm">
            <h2 className="font-serif text-2xl">{step === "findings" ? "Flagged findings" : "Polite pushback email"}</h2>
            <p className="text-sm text-ink-light" aria-live="polite">{count("critical")} critical · {count("warning")} warning · {resolved.length} resolved</p>
            <div role="tablist" aria-label="Analysis steps" className="mt-3 flex gap-2">
              <button type="button" role="tab" id="tab-findings" aria-selected={step === "findings"} aria-controls="panel" onClick={() => go("findings")}
                className={`${TAB} ${step === "findings" ? "bg-ink text-white" : "border border-ink/20 bg-white"}`}>1 · Review findings ({findings.length})</button>
              <button type="button" role="tab" id="tab-email" aria-selected={step === "email"} aria-controls="panel" onClick={() => go("email")}
                className={`${TAB} ${step === "email" ? "bg-ink text-white" : "border border-ink/20 bg-white"}`}>2 · Compose email</button>
            </div>
          </div>
          <div id="panel" role="tabpanel" aria-labelledby={step === "findings" ? "tab-findings" : "tab-email"}>
          {step === "findings" && <>
          {findings.length === 0 && <p className="mb-4 rounded-lg bg-sage p-3 text-sm">No findings. None of the seven traps appear in this text.</p>}
          <ul className="space-y-4">
            {findings.map((f) => {
              const done = resolved.includes(f.id);
              const critical = f.severity === "critical";
              const Icon = done ? CircleCheck : critical ? OctagonAlert : TriangleAlert;
              const edge = done ? "border-sage-dark" : critical ? "border-terracotta-dark" : "border-amber-dark";
              return (
                <li key={f.id}><article className={`rounded-xl border transition-shadow motion-reduce:transition-none border-ink/15 border-l-4 p-4 ${edge} ${done ? "bg-sage/40" : "bg-ivory"} ${active?.id === f.id ? "ring-2 ring-ink" : ""}`}>
                  <p className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${done ? "bg-sage" : critical ? "bg-terracotta" : "bg-amber"}`}><Icon aria-hidden="true" size={14} />{done ? "Resolved" : critical ? "Critical" : "Warning"}</p>
                  <h3 className="mt-1 font-semibold">{TRAPS[f.trap]}</h3>
                  <button type="button" onClick={() => select(f.id)} className="mt-3 block min-h-11 w-full rounded-lg bg-white p-3 text-left font-serif text-sm leading-relaxed focus-visible:outline-[3px] focus-visible:outline-ink">“{show(f.quote)}” <span className="block text-xs font-sans text-ink-light">Show in document</span></button>
                  {located && !located.includes(f.id) && <p className="mt-2 text-xs text-ink-light">Couldn’t locate this passage in the PDF.</p>}
                  <p className="mt-3 text-sm"><strong>Impact: </strong>{show(f.impact)}</p>
                  <p className="mt-1 text-sm"><strong>Suggestion: </strong>{show(f.suggestion)}</p>
                  <button type="button" aria-pressed={done} onClick={() => void toggleResolved(f.id)} className={`${BTN} mt-3`}>{done && <CircleCheck aria-hidden="true" size={16} />}Mark resolved</button>
                </article></li>
              );
            })}
          </ul>
          {analysis.notFound.length > 0 && <details className="mt-4 rounded-lg bg-sage p-3 text-sm"><summary className="cursor-pointer">{analysis.notFound.length} traps not found</summary>
            <ul className="mt-2 list-disc pl-5">{analysis.notFound.map((t) => <li key={t}>{TRAPS[t]}</li>)}</ul></details>}
          <p className="mt-6 text-xs text-ink-light">Commercial analysis, not legal advice.</p>
          </>}
          {step === "email" && <section aria-label="Pushback email">
            <p className="text-sm text-ink-light">{open.length ? `Covers the ${open.length} finding${open.length === 1 ? "" : "s"} you haven’t marked resolved.` : "Nothing left to push back on."}</p>
            <label className="mt-4 block text-sm font-medium" htmlFor="leverage">Deal leverage: {TONES[tone]}</label>
            <input id="leverage" type="range" min={0} max={2} step={1} value={tone} onChange={(e) => setTone(Number(e.target.value))}
              aria-valuetext={TONES[tone]} className="mt-2 w-full accent-ink" />
            <div className="flex justify-between text-xs text-ink-light" aria-hidden="true"><span>Soft</span><span>Balanced</span><span>Firm</span></div>
            <label className="sr-only" htmlFor="email">Pushback email</label>
            <textarea id="email" readOnly value={email} rows={16} className="mt-3 w-full rounded-lg border border-ink/20 bg-white p-3 text-sm leading-relaxed" />
            <p role="status" className="mt-2 text-xs text-ink-light">{message}</p>
          </section>}
          </div>
          <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 bg-white/95 px-4 py-3 backdrop-blur-sm">
            {step === "findings" ? <>
              <p className="text-sm text-ink-light">{open.length} to push back on</p>
              <button type="button" onClick={() => go("email")} className={PRIMARY}>Compose pushback email<ArrowRight aria-hidden="true" size={16} /></button>
            </> : <>
              <button type="button" onClick={() => go("findings")} className={BTN}><ArrowLeft aria-hidden="true" size={16} />Back to findings</button>
              <button type="button" onClick={() => void copyEmail()} className={PRIMARY}><Copy aria-hidden="true" size={16} />Copy email</button>
            </>}
          </div>
        </section>
      </div>
    </div>
  );
}
