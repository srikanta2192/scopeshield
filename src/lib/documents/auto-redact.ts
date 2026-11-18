import type { DocumentPage, Redaction } from "./types";

export type RedactionSuggestion = Redaction & { occurrences: number };

export function restoreRedactionSuggestions(pages: DocumentPage[], redactions: Redaction[]): RedactionSuggestion[] {
  const text = pages.map((page) => page.text).join("\n");
  return redactions.filter((rule) => rule.kind !== "manual" && rule.value.length > 0).map((rule) => ({
    ...rule,
    occurrences: [...text.matchAll(new RegExp(escapeRegex(rule.value), "giu"))].length,
  }));
}

const COMMON_CONTRACT_WORDS = new Set([
  "A", "All", "Agreement", "Applicable", "Any", "Background", "By", "Client", "Company",
  "Confidential", "Contract", "Contractor", "Customer", "Data", "Date", "Early", "Each",
  "Effective", "Either", "Exhibit", "First", "Force", "Information", "Intellectual", "Late",
  "Liability", "New", "No", "Our", "Party", "Parties", "Payment", "Project", "Property",
  "Schedule", "Scope", "Section", "Second", "Services", "Statement", "Subject", "Termination",
  "That", "The", "These", "This", "Those", "Third", "Upon", "Vendor", "We", "Work", "Your",
]);

/** Conservative local suggestions; review them because automatic detection is never complete. */
export async function suggestRedactions(pages: DocumentPage[]): Promise<RedactionSuggestion[]> {
  const text = pages.map((page) => page.text).join("\n");
  const candidates = new Map<string, string>();
  const addCandidate = (raw: string, kind: string) => {
    const value = raw.trim().replace(/[.,;:]+$/, "");
    if (value.length > 2) candidates.set(value.toLowerCase(), kind);
  };
  const collect = (pattern: RegExp, kind: string) => {
    for (const match of text.matchAll(pattern)) addCandidate(match[0], kind);
  };
  const collectGroup = (pattern: RegExp, kind: string) => {
    for (const match of text.matchAll(pattern)) if (match[1]) addCandidate(match[1], kind);
  };

  collect(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "email");
  for (const match of text.matchAll(/(?:\+?\d[\d ().-]{7,}\d)/g)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const prefix = text.slice(Math.max(0, start - 8), start);
    const suffix = text.slice(end, end + 6);
    const currency = /(?:[$€£₹]|\b(?:USD|EUR|GBP|INR|AUD|CAD|JPY)\s*)\s*$/i.test(prefix)
      || /^\s*(?:USD|EUR|GBP|INR|AUD|CAD|JPY)\b/i.test(suffix);
    if (!currency) addCandidate(match[0], "possible phone number");
  }
  collectGroup(/\b(?:account(?:\s+(?:number|no\.?))?|tax\s+id|ssn|social\s+security(?:\s+number)?|passport(?:\s+number)?|license(?:\s+number)?|identification(?:\s+number)?|id\s+no\.?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{4,19})\b/gi, "labeled account or ID number");
  collect(/\b\d{1,6}\s+[\w.'-]+(?:\s+[\w.'-]+){0,5}\s+(?:street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|lane|ln\.?|drive|dr\.?|court|ct\.?|way)\b(?:[^\n,;]{0,30})?/gi, "possible street address");
  collectGroup(/\b(?:signed\s+by|signature\s*[:=-]?|by\s*[:=-])\s*([^\n,;]{2,80})/gi, "possible signature name");
  collectGroup(/\b(?:client|customer|company|vendor|contractor|agency|attention|contact|from|to)\s*(?:is\s*)?[:,-]\s*([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){1,3})/gi, "possible person or organization");

  for (const match of text.matchAll(/\b[A-Z][a-z]+(?:[-'][A-Za-z]+)*(?:\s+[A-Z][a-z]+(?:[-'][A-Za-z]+)*){1,2}\b/g)) {
    const words = match[0].split(/\s+/);
    if (words.some((word) => COMMON_CONTRACT_WORDS.has(word))) continue;
    addCandidate(match[0], "possible person or organization");
  }

  const values = [...candidates.keys()].sort((a, b) => b.length - a.length);
  return values.map((value, index) => {
    const escaped = escapeRegex(value);
    const matches = [...text.matchAll(new RegExp(escaped, "giu"))];
    return {
      value: findOriginalText(text, value), replacement: `[REDACTED_${index + 1}]`,
      kind: candidates.get(value), occurrences: matches.length,
    };
  });
}

function findOriginalText(text: string, lower: string) {
  const index = text.toLowerCase().indexOf(lower);
  return index < 0 ? lower : text.slice(index, index + lower.length);
}

export function applyRedactions(text: string, rules: Redaction[]): string {
  const ordered = rules.filter((rule) => rule.value.length > 0).sort((a, b) => b.value.length - a.value.length);
  if (!ordered.length) return text;
  const escaped = ordered.map(({ value }) => escapeRegex(value));
  return text.replace(new RegExp(escaped.join("|"), "giu"), (match) =>
    ordered.find((rule) => rule.value.toLowerCase() === match.toLowerCase())!.replacement);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
