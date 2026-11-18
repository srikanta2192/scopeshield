import type { Redaction } from "../documents/types";

/** Puts the original values back into model text that carries [REDACTED_n] placeholders. Local only. */
export function unredact(text: string, redactions: Redaction[]): string {
  return redactions.reduce((out, r) => out.split(r.replacement).join(r.value), text);
}

export type Range = { item: number; from: number; to: number };

// Whitespace-collapsed, lower-cased text with a char -> (item, char-in-item) map. -1 marks a separator.
function flatten(parts: string[]) {
  let text = "";
  const map: Array<[number, number]> = [];
  const push = (ch: string, item: number, at: number) => {
    if (/\s/.test(ch)) { if (!text || text.endsWith(" ")) return; ch = " "; } else ch = ch.toLowerCase().charAt(0);
    text += ch; map.push([item, at]);
  };
  parts.forEach((part, i) => { for (let j = 0; j < part.length; j++) push(part[j], i, j); push(" ", i, -1); });
  return { text, map };
}

function rangesAt(map: Array<[number, number]>, start: number, length: number): Range[] {
  const ranges = new Map<number, Range>();
  for (const [item, at] of map.slice(start, start + length)) {
    if (at < 0) continue;
    const r = ranges.get(item);
    if (r) r.to = at + 1; else ranges.set(item, { item, from: at, to: at + 1 });
  }
  return [...ranges.values()];
}

/** Finds `quote` in a page's text items; returns the character range to highlight in each item, or null. */
export function locateQuote(items: string[], quote: string): Range[] | null {
  const q = flatten([quote]).text.trim();
  const { text, map } = flatten(items);
  const start = q ? text.indexOf(q) : -1;
  const ranges = start < 0 ? [] : rangesAt(map, start, q.length);
  return ranges.length ? ranges : null;
}

/** Like locateQuote, but returns every occurrence on the page. */
export function locateAll(items: string[], quote: string): Range[] | null {
  const q = flatten([quote]).text.trim();
  if (!q) return null;
  const { text, map } = flatten(items);
  const out: Range[] = [];
  for (let at = text.indexOf(q); at >= 0; at = text.indexOf(q, at + q.length)) out.push(...rangesAt(map, at, q.length));
  return out.length ? out : null;
}
