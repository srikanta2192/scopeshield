"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { locateAll, locateQuote } from "@/lib/analysis/locate";
import "./pdf-viewer.css";
import type { Severity } from "@/lib/analysis/types";

/** `severity` is only used by the findings view; "redact" mode paints solid black boxes instead. */
export type Highlight = { id: string; quote: string; severity?: Severity };
export type Active = { id: string; n: number } | null;
type Rect = { id: string; x: number; y: number; w: number; h: number };
type Item = { str: string; transform: number[]; width: number };
type Common = {
  highlights: Highlight[]; mode?: "redact"; resolved?: string[]; active?: Active; onSelect?: (id: string) => void;
  /** redact mode: called with text the user selects in the PDF */
  onSelectText?: (text: string) => void;
};

const SCALE = 1.5;
const PAD = 3; // redaction boxes overshoot slightly so glyph edges are never left showing
let measurer: CanvasRenderingContext2D | null | undefined;
/** Horizontal offset and width of item.str[from, to), in px. Proportional-font aware, normalised to the item's real width. */
function span(item: Item, from: number, to: number, fontPx: number): [number, number] {
  measurer ??= document.createElement("canvas").getContext("2d");
  const real = item.width * SCALE;
  if (!measurer) return [real * from / (item.str.length || 1), real * (to - from) / (item.str.length || 1)];
  measurer.font = `${fontPx}px Helvetica, Arial, sans-serif`;
  const k = real / (measurer.measureText(item.str).width || 1);
  return [measurer.measureText(item.str.slice(0, from)).width * k, measurer.measureText(item.str.slice(from, to)).width * k];
}
const TONE: Record<Severity, string> = {
  critical: "bg-terracotta-dark/30 border-terracotta-dark",
  warning: "bg-amber-dark/30 border-amber-dark",
};

function PdfPage({ doc, n, highlights, mode, resolved = [], active = null, onSelect, onPage }: Common & {
  doc: PDFDocumentProxy; n: number; onPage: (found: string[]) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<[number, number]>([612, 792]);
  const [rects, setRects] = useState<Rect[]>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const textLayer = useRef<HTMLDivElement>(null);

  // Selectable text layer (redact mode only); its font sizes follow the displayed page width.
  useEffect(() => {
    if (mode !== "redact") return;
    let dead = false;
    let layer: { cancel(): void } | undefined;
    const box = textLayer.current, outer = wrap.current;
    if (!box || !outer) return;
    (async () => {
      const [{ TextLayer }, page] = await Promise.all([import("pdfjs-dist"), doc.getPage(n)]);
      const natural = page.getViewport({ scale: 1 });
      const fit = () => box.style.setProperty("--total-scale-factor", String(outer.clientWidth / natural.width));
      fit();
      new ResizeObserver(fit).observe(outer);
      box.replaceChildren();
      const tl = new TextLayer({ textContentSource: page.streamTextContent(), container: box, viewport: natural });
      layer = tl;
      await tl.render();
      if (dead) box.replaceChildren();
    })().catch(() => {});
    return () => { dead = true; layer?.cancel(); };
  }, [doc, n, mode]);

  useEffect(() => {
    let dead = false;
    let render: { cancel(): void; promise: Promise<unknown> } | undefined;
    (async () => {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: SCALE });
      const c = canvas.current;
      if (dead || !c) return;
      c.width = viewport.width; c.height = viewport.height;
      setSize([viewport.width, viewport.height]);
      render = page.render({ canvas: c, canvasContext: c.getContext("2d")!, viewport });
      await render.promise;
    })().catch(() => {});
    return () => { dead = true; render?.cancel(); };
  }, [doc, n]);

  useEffect(() => {
    let dead = false;
    (async () => {
      const [{ Util }, page] = await Promise.all([import("pdfjs-dist"), doc.getPage(n)]);
      const viewport = page.getViewport({ scale: SCALE });
      const items = (await page.getTextContent()).items.filter((i) => "str" in i) as unknown as Item[];
      const locate = mode === "redact" ? locateAll : locateQuote;
      const pad = mode === "redact" ? PAD : 0;
      const out: Rect[] = [];
      for (const h of highlights) {
        for (const r of locate(items.map((i) => i.str), h.quote) ?? []) {
          const item = items[r.item];
          const t = Util.transform(viewport.transform, item.transform);
          const height = Math.hypot(t[2], t[3]);
          const [dx, w] = span(item, r.from, r.to, height);
          out.push({ id: h.id, x: t[4] + dx - pad, y: t[5] - height - pad, w: w + pad * 2, h: height + pad * 2 });
        }
      }
      if (dead) return;
      setRects(out); onPage([...new Set(out.map((r) => r.id))]);
    })().catch(() => {});
    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- onPage only accumulates; re-running on its identity would recompute every box
  }, [doc, n, highlights, mode]);

  const severity = Object.fromEntries(highlights.map((h) => [h.id, h.severity ?? "warning"]));
  // The canvas is absolutely positioned so its pixel width never feeds into the grid column's min-content (Safari).
  return (
    <div ref={wrap} className="relative mb-4 w-full min-w-0 bg-white shadow-md last:mb-0" style={{ aspectRatio: `${size[0]} / ${size[1]}` }}>
      <canvas ref={canvas} className="absolute inset-0 block h-full w-full" aria-label={`Contract page ${n}`} role="img" />
      {rects.map((r, i) => {
        const pos = { left: `${r.x / size[0] * 100}%`, top: `${r.y / size[1] * 100}%`, width: `${r.w / size[0] * 100}%`, height: `${r.h / size[1] * 100}%` };
        if (mode === "redact") return <div key={i} aria-hidden="true" data-redaction={r.id} className="pointer-events-none absolute z-[1] bg-ink" style={pos} />;
        const tone = resolved.includes(r.id) ? "bg-sage-dark/30 border-sage-dark" : TONE[severity[r.id]];
        return <div key={i} aria-hidden="true" data-finding={r.id} onClick={() => onSelect?.(r.id)}
          className={`absolute cursor-pointer border-b-2 mix-blend-multiply ${tone} ${active?.id === r.id ? "animate-pulse outline-2 outline-ink motion-reduce:animate-none" : ""}`}
          style={pos} />;
      })}
      {mode === "redact" && <div ref={textLayer} className="ss-textLayer" />}
    </div>
  );
}

/** Renders the original PDF in the browser and paints boxes over matched text. Nothing leaves the device. */
export function PdfViewer({ pdf, onSettled, onSelectText, ...common }: Common & { pdf: Blob; onSettled?: (found: string[]) => void }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const found = useRef(new Set<string>());
  const done = useRef(0);

  useEffect(() => {
    let dead = false;
    let task: { destroy(): Promise<void> } | undefined;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const loading = pdfjs.getDocument({ data: new Uint8Array(await pdf.arrayBuffer()) });
      task = loading;
      const loaded = await loading.promise;
      if (!dead) setDoc(loaded);
    })().catch(() => { if (!dead) setFailed(true); });
    return () => { dead = true; void task?.destroy(); };
  }, [pdf]);

  const { active } = common;
  useEffect(() => {
    if (!active) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = root.current?.querySelector(`[data-finding="${active.id}"]`);
    const pane = root.current?.parentElement;
    if (!el || !pane) return;
    // Scroll only the PDF pane; scrollIntoView would also move the whole page.
    const top = el.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop - pane.clientHeight / 2;
    pane.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
  }, [active]);

  if (failed) return <p role="alert" className="p-4 text-sm">Could not display this PDF. Use the text view instead.</p>;
  if (!doc) return <p role="status" className="p-4 text-sm text-ink-light">Loading PDF…</p>;
  const pick = () => window.setTimeout(() => {
    const sel = window.getSelection();
    const text = sel?.toString().replace(/\s+/g, " ").trim() ?? "";
    if (!onSelectText || text.length < 2 || !sel?.anchorNode || !root.current?.contains(sel.anchorNode)) return;
    onSelectText(text); sel.removeAllRanges();
  }, 0);
  return <div ref={root} onMouseUp={pick} onTouchEnd={pick}>{Array.from({ length: doc.numPages }, (_, i) =>
    <PdfPage key={i} doc={doc} n={i + 1} {...common} onPage={(ids) => {
      ids.forEach((id) => found.current.add(id));
      if (++done.current === doc.numPages) onSettled?.([...found.current]);
    }} />)}</div>;
}
