import { TRAPS, type AnalysisResult, type Finding, type TrapId } from "./types";

type Demo = Omit<Finding, "id">;
const f = (trap: TrapId, severity: Demo["severity"], quote: string, impact: string, suggestion: string,
  soft: string, balanced: string, firm: string): Demo =>
  ({ trap, severity, quote, impact, suggestion, pushback: { soft, balanced, firm } });

// Canned findings for test-fixtures/scopeshield-demo-contract.pdf, used only when no OpenAI key is set in local dev.
const DEMO: Demo[] = [
  f("payment_on_acceptance", "critical", "payable within 90 days after acceptance.",
    "Payment waits on an undefined acceptance step, then another 90 days. Cash flow is at the client's discretion.",
    "Tie payment to delivery milestones, net 14 or 30, with deemed acceptance after 5 business days of silence.",
    "Would you be open to a deposit up front and the balance within 30 days of delivery? It helps me plan capacity.",
    "I'd like to move to milestone-based payments, net 30, with acceptance deemed after 5 business days.",
    "I can't accept 90 days after an open-ended acceptance. I need milestone payments, net 30, and deemed acceptance."),
  f("long_payment_early_ip", "critical", "Client may transfer project IP upon delivery, before payment is complete.",
    "The client gets ownership of the work before paying for it, which removes your main leverage if payment is late.",
    "IP transfers only on receipt of full payment; a licence to use the work applies in the meantime.",
    "Could we have the IP transfer take effect once the final payment clears? It's a common arrangement.",
    "Please change the IP clause so ownership transfers on full payment, with a usage licence until then.",
    "IP must not transfer before payment in full. I need this clause rewritten before I can sign."),
  f("scope_creep", "warning", "No limit on the number of requested revisions is specified.",
    "Open-ended revisions let the scope grow without any added fee.",
    "Cap revisions at two rounds and price further work at your hourly rate with written approval.",
    "Could we confirm the two rounds of revisions mentioned in section 1 as the cap, with extra work quoted separately?",
    "Section 2 of the schedule leaves revisions unlimited. Please cap them at two rounds, with extra work billed hourly.",
    "Unlimited revisions aren't workable. Revisions are capped at two rounds, and anything further is billed."),
  f("uncapped_liability", "warning", "Each party is responsible for its own acts and omissions.",
    "Without a liability cap, a single mistake could expose you to losses far larger than the project fee.",
    "Cap total liability at the fees paid under the agreement and exclude indirect damages.",
    "Would you be comfortable capping liability at the project fee? That's standard for a project this size.",
    "Please add a clause capping total liability at the fees paid and excluding indirect or consequential damages.",
    "I need liability capped at the project fee, with indirect damages excluded, before signing."),
  f("missing_termination_fee", "warning", "Either party may end the agreement with 14 days written notice.",
    "The client can walk away mid-project with no payment for work done or reserved time.",
    "Add payment for work completed to date plus a kill fee (e.g. 20% of the remaining fee).",
    "If the project ends early, could we agree that completed work is paid for and a small kill fee applies?",
    "Please add that on termination I'm paid for work completed to date plus a kill fee of 20% of the remaining fee.",
    "Termination must include payment for all work done plus a 20% kill fee on the remainder."),
];

const squash = (s: string) => s.replace(/\s+/g, " ").toLowerCase();

export function demoAnalysis(redactedText: string): AnalysisResult {
  const text = squash(redactedText);
  const hits = DEMO.filter((d) => text.includes(squash(d.quote)));
  const found = new Set(hits.map((d) => d.trap));
  return {
    findings: hits.map((d, i) => ({ ...d, id: `f${i + 1}` })),
    notFound: (Object.keys(TRAPS) as TrapId[]).filter((t) => !found.has(t)),
  };
}
