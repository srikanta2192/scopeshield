import { NextResponse } from "next/server";
import { analyzeRedactedText } from "@/lib/analysis/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { refundAnalysisCredit, reserveAnalysisCredit } from "@/lib/billing/credits";

const MAX_TEXT_LENGTH = 80_000;
const MAX_BODY_BYTES = 330_000;
const NO_STORE = { "Cache-Control": "no-store" };

function json(data: unknown, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json(data, { status, headers: { ...NO_STORE, ...headers } });
}

export async function POST(request: Request) {
  const localDevAnalysis = process.env.NODE_ENV === "development" && process.env.LOCAL_ANALYSIS_ENABLED === "true";
  if (process.env.ANALYSIS_ENABLED !== "true" && !localDevAnalysis) {
    return json({ error: "Contract analysis is not enabled for this deployment." }, 503);
  }
  let userId: string | undefined;
  if (!localDevAnalysis) {
    let user;
    try { user = await getAuthenticatedUser(); }
    catch { return json({ error: "Account services are not available." }, 503); }
    if (!user) return json({ error: "Sign in to use analysis credits.", code: "unauthenticated" }, 401);
    userId = user.id;
  }

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return json({ error: "This document is too large to analyze in one request." }, 413);
  }
  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
      return json({ error: "This document is too large to analyze in one request." }, 413);
    }
    body = JSON.parse(rawBody);
  }
  catch { return json({ error: "Send valid JSON containing reviewed redacted text." }, 400); }
  const redactedText = typeof body === "object" && body !== null && "redactedText" in body
    ? (body as { redactedText: unknown }).redactedText : undefined;
  if (typeof redactedText !== "string" || !redactedText.trim()) {
    return json({ error: "Reviewed redacted text is required." }, 400);
  }
  if (redactedText.length > MAX_TEXT_LENGTH) {
    return json({ error: "This document is too long to analyze in one request." }, 413);
  }
  const requestId = localDevAnalysis ? undefined : crypto.randomUUID();
  if (!localDevAnalysis && userId && requestId) {
    let reservation;
    try { reservation = await reserveAnalysisCredit(userId, requestId); }
    catch { return json({ error: "Credit services are not available." }, 503); }
    if (reservation === "no_credits") {
      return json({ error: "You need an analysis credit to continue.", code: "no_credits" }, 402);
    }
    if (reservation === "rate_limited") {
      return json({ error: "Please wait before starting another analysis.", code: "rate_limited" }, 429, { "Retry-After": "60" });
    }
    if (reservation !== "reserved") {
      return json({ error: "This request could not be reserved.", code: "reservation_failed" }, 409);
    }
  }

  try {
    const result = await analyzeRedactedText(redactedText, request.signal);
    return json(result, 200);
  } catch {
    let creditReturned = localDevAnalysis;
    if (!localDevAnalysis && userId && requestId) {
      try { await refundAnalysisCredit(userId, requestId); creditReturned = true; }
      catch { console.error("Analysis failed and the reserved credit could not be refunded."); }
    }
    return json({
      error: creditReturned
        ? localDevAnalysis
          ? "Analysis is temporarily unavailable. Your document content was not saved by ScopeShield; local development mode did not use a credit."
          : "Analysis is temporarily unavailable. Your document content was not saved by ScopeShield and the credit was returned."
        : "Analysis is temporarily unavailable. Your document content was not saved by ScopeShield. Contact support if the credit was deducted.",
    }, 502);
  }
}
