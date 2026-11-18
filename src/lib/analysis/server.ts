import { demoAnalysis } from "./demo";
import { TRAPS, type AnalysisResult, type Finding, type TrapId } from "./types";

const TRAP_IDS = Object.keys(TRAPS) as TrapId[];
const str = { type: "string" };
const SCHEMA = {
  type: "object", additionalProperties: false, required: ["findings", "not_found"],
  properties: {
    findings: { type: "array", items: {
      type: "object", additionalProperties: false,
      required: ["trap", "severity", "quote", "impact", "suggestion", "pushback_soft", "pushback_balanced", "pushback_firm"],
      properties: {
        trap: { type: "string", enum: TRAP_IDS }, severity: { type: "string", enum: ["critical", "warning"] },
        quote: str, impact: str, suggestion: str, pushback_soft: str, pushback_balanced: str, pushback_firm: str,
      },
    } },
    not_found: { type: "array", items: { type: "string", enum: TRAP_IDS } },
  },
};

const SYSTEM_PROMPT = `You are ScopeShield, a commercial contract and scope analyst for freelance software developers and small agencies. Review the supplied redacted contract text for exactly these seven risks (use these ids): ${TRAP_IDS.map((id) => `${id} = ${TRAPS[id]}`).join("; ")}. Ground every finding only in the provided text. For each finding: "quote" must be copied verbatim from the text (one or two sentences, no paraphrase, keep any [REDACTED_n] placeholders); "severity" is critical when it can cost the freelancer money or ownership, otherwise warning; "impact" is one sentence of practical impact; "suggestion" is one sentence of practical advice; "pushback_soft", "pushback_balanced" and "pushback_firm" are one or two sentences each, first person, to the client, in a gentle, direct and firm tone respectively, without greeting or sign-off. List a risk id in not_found when the text does not contain it. This is commercial analysis, not legal advice.`;

export async function analyzeRedactedText(redactedText: string, signal?: AbortSignal): Promise<AnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey && process.env.NODE_ENV === "development" && process.env.LOCAL_ANALYSIS_ENABLED === "true") {
    return demoAnalysis(redactedText);
  }
  if (!apiKey || !model) throw new Error("Contract analysis is not configured yet.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, store: false,
      text: { format: { type: "json_schema", name: "scopeshield_findings", strict: true, schema: SCHEMA } },
      input: [
        { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT }] },
        { role: "user", content: [{ type: "input_text", text: redactedText }] },
      ] }),
  });
  if (!response.ok) throw new Error("The analysis service could not complete this request.");
  const payload = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  const text = payload.output?.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text").map((item) => item.text ?? "").join("\n").trim();
  if (!text) throw new Error("The analysis service returned no findings.");
  const raw = JSON.parse(text) as { findings: Array<Record<string, string>>; not_found: TrapId[] };
  const findings: Finding[] = raw.findings.filter((r) => r.trap in TRAPS && r.quote).map((r, i) => ({
    id: `f${i + 1}`, trap: r.trap as TrapId, severity: r.severity === "critical" ? "critical" : "warning",
    quote: r.quote, impact: r.impact, suggestion: r.suggestion,
    pushback: { soft: r.pushback_soft, balanced: r.pushback_balanced, firm: r.pushback_firm },
  }));
  return { findings, notFound: raw.not_found.filter((t) => t in TRAPS) };
}
