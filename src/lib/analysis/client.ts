import type { AnalysisResult } from "./types";

export class AnalysisRequestError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = "AnalysisRequestError";
  }
}

export async function requestContractAnalysis(redactedText: string, signal?: AbortSignal): Promise<AnalysisResult> {
  const response = await fetch("/api/analyze", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ redactedText }), signal,
  });
  const payload = await response.json() as Partial<AnalysisResult> & { error?: string; code?: string };
  if (!response.ok) throw new AnalysisRequestError(payload.error ?? "Could not analyze the redacted text.", payload.code);
  if (!Array.isArray(payload.findings)) throw new Error("The analysis service returned no findings.");
  return { findings: payload.findings, notFound: payload.notFound ?? [] };
}
