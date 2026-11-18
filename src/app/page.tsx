import Link from "next/link";
import { ArrowRight, Check, FileText, LockKeyhole, ScanText, ShieldCheck } from "lucide-react";

const STEPS = [
  { icon: FileText, title: "Start with your PDF", description: "Extract and redact PDF text in your browser. Your original document stays on this device." },
  { icon: ScanText, title: "Review what you share", description: "Compare the original and redacted text side by side. Check automatic suggestions and add your own redactions." },
  { icon: ShieldCheck, title: "Choose your next step", description: "Download a redacted text-only PDF for free, or use a credit for optional AI contract analysis." },
] as const;

const RISKS = ["Background IP", "Payment on acceptance", "Scope & revisions", "Payment & IP timing", "Liability & indemnity", "Non-compete terms", "Termination & kill fees"];
const primaryLink = "inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-ink px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-ink-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink";

export default function HomePage() {
  return (
    <div>
      <section aria-labelledby="hero-title" className="mx-auto grid w-full max-w-7xl items-center gap-12 px-6 py-12 sm:py-20 lg:grid-cols-[1fr_1fr] lg:gap-16 lg:py-24">
        <div className="min-w-0">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-sage-border bg-sage px-3 py-2 text-xs font-semibold text-ink"><LockKeyhole aria-hidden="true" className="size-4 shrink-0" />Your document. Your control.</p>
          <h1 id="hero-title" className="max-w-xl text-balance font-serif text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">Protect your work.<br />Before you sign.</h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-ink-light sm:text-lg">A commercial deal &amp; scope analyzer for freelance tech builders and small agencies. Prepare your contract privately, then take a closer look at the terms that matter.</p>
          <div className="mt-8 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
            <Link href="/app/upload" className={primaryLink}>Prepare your contract<ArrowRight aria-hidden="true" className="size-4" /></Link>
            <Link href="#how-it-works" className="inline-flex min-h-12 items-center justify-center rounded-lg px-3 text-sm font-medium underline decoration-ink/30 underline-offset-4 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-4">See how it works</Link>
          </div>
          <p className="mt-4 text-sm text-ink-light">Local redaction is free. No account needed to get started.</p>
        </div>

        <figure className="min-w-0 rounded-2xl border border-ink/15 bg-white p-4 shadow-xl shadow-ink/5 sm:p-6">
          <figcaption className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-4"><span className="flex items-center gap-2 text-sm font-semibold"><FileText aria-hidden="true" className="size-4" />A closer look at your contract</span><span className="rounded-md bg-alabaster px-2 py-1 text-xs text-ink-light">Illustrative example</span></figcaption>
          <div className="rounded-xl border border-ink/10 bg-ivory p-5 sm:p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-light">01 / Original text · stays local</p>
            <p className="font-serif text-xl leading-relaxed">This agreement is between <mark className="rounded bg-terracotta px-1 text-ink">Acme Studio</mark> and the Contractor. Payment is due within 90 days of acceptance.</p>
          </div>
          <div className="my-3 flex items-center justify-center gap-2 text-xs font-medium text-ink-light"><LockKeyhole aria-hidden="true" className="size-3.5" />You review every redaction</div>
          <div className="rounded-xl border border-sage-border bg-sage/50 p-5 sm:p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-light">02 / Redacted text · ready for review</p>
            <p className="font-serif text-xl leading-relaxed">This agreement is between <span className="inline-block rounded bg-ink px-2 py-0.5 align-baseline font-sans text-sm font-medium text-white">[REDACTED_1]</span> and the Contractor. Payment is due within 90 days of acceptance.</p>
          </div>
          <p className="mt-5 flex items-start gap-2 text-sm leading-relaxed text-ink-light"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />Nothing is sent for AI analysis until you approve the redacted text.</p>
        </figure>
      </section>

      <section id="how-it-works" aria-labelledby="workflow-title" className="scroll-mt-24 border-y border-ink/10 bg-white/60">
        <div className="mx-auto max-w-7xl px-6 py-14 sm:py-20">
          <div className="mb-10 max-w-2xl"><p className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-light">A deliberate workflow</p><h2 id="workflow-title" className="text-balance font-serif text-3xl sm:text-4xl">Less guesswork. More control.</h2><p className="mt-4 leading-relaxed text-ink-light">Start with local document preparation. Choose AI analysis only when you’re ready: only the reviewed redacted text is sent for analysis.</p></div>
          <ol className="grid gap-8 md:grid-cols-3 md:gap-10">{STEPS.map(({ icon: Icon, title, description }, index) => <li key={title} className="min-w-0 border-t border-ink/15 pt-5"><div className="mb-5 flex items-center justify-between"><span className="flex size-11 items-center justify-center rounded-xl bg-terracotta"><Icon aria-hidden="true" className="size-5 text-ink" /></span><span aria-hidden="true" className="font-serif text-2xl text-ink-light">0{index + 1}</span></div><h3 className="mb-3 text-lg font-semibold">{title}</h3><p className="text-sm leading-relaxed text-ink-light">{description}</p></li>)}</ol>
        </div>
      </section>

      <section aria-labelledby="risks-title" className="mx-auto grid max-w-7xl gap-8 px-6 py-14 sm:py-20 lg:grid-cols-2 lg:gap-16">
        <div><p className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-light">Optional AI analysis</p><h2 id="risks-title" className="text-balance font-serif text-3xl sm:text-4xl">Small clauses.<br />Real commercial consequences.</h2><p className="mt-5 max-w-lg leading-relaxed text-ink-light">Check for seven commercial risks, including IP transfer, payment terms, and scope creep. Get practical negotiation suggestions grounded in the redacted text you choose to share.</p><Link href="/pricing" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded text-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">View analysis credits<ArrowRight aria-hidden="true" className="size-4" /></Link></div>
        <ul aria-label="Seven commercial risks" className="grid content-center gap-3 sm:grid-cols-2">{RISKS.map((risk, index) => <li key={risk} className="flex min-w-0 items-center gap-3 rounded-lg border border-ink/10 bg-ivory px-4 py-4 text-sm"><span aria-hidden="true" className="font-serif text-lg text-ink-light">0{index + 1}</span><span>{risk}</span></li>)}</ul>
      </section>

      <section aria-labelledby="start-title" className="mx-auto mb-12 max-w-7xl px-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-sage-border bg-sage p-6 sm:p-10 md:flex-row md:items-center"><div><h2 id="start-title" className="font-serif text-3xl">Your next contract deserves a closer look.</h2><p className="mt-3 text-sm leading-relaxed text-ink-light">Prepare and review it locally. Decide what happens next.</p></div><Link href="/app/upload" className={`${primaryLink} shrink-0`}>Get started free<ArrowRight aria-hidden="true" className="size-4" /></Link></div>
      </section>
      <footer className="border-t border-ink/10"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-6 py-7 text-sm text-ink-light sm:flex-row"><p>ScopeShield · Built for independent tech builders.</p><Link href="/contact" className="inline-flex min-h-6 items-center rounded underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">Get in touch</Link></div></footer>
    </div>
  );
}
