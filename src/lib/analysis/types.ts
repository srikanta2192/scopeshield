export const TRAPS = {
  background_ip: "Background IP transfer",
  payment_on_acceptance: "Payment on acceptance",
  scope_creep: "Scope creep and unlimited revisions",
  long_payment_early_ip: "Long payment terms with early IP transfer",
  uncapped_liability: "Uncapped liability or indemnity",
  broad_noncompete: "Broad non-compete",
  missing_termination_fee: "Missing termination fee",
} as const;

export type TrapId = keyof typeof TRAPS;
export type Severity = "critical" | "warning";
export type Tone = "soft" | "balanced" | "firm";

export type Finding = {
  id: string;
  trap: TrapId;
  severity: Severity;
  /** Verbatim from the redacted text; may contain [REDACTED_n] placeholders. */
  quote: string;
  impact: string;
  suggestion: string;
  pushback: Record<Tone, string>;
  resolved?: boolean;
};

export type AnalysisResult = { findings: Finding[]; notFound: TrapId[] };
export type AnalysisRequest = { redactedText: string };
