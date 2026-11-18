import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutButton } from "./checkout-button";

export const metadata: Metadata = {
  title: "Pricing | ScopeShield",
  description:
    "Freelancer-friendly pricing. Pay only for the deals you shield — no expensive subscriptions.",
};

const PLANS = [
  {
    id: "single",
    name: "Single Contract",
    price: "$9",
    billing: "one-time",
    features: [
      "1 AI contract analysis",
      "Covers 7 commercial risk areas",
      "Local redaction and review are free",
    ],
    cta: "Buy 1 Credit",
    highlighted: false,
  },
  {
    id: "pack",
    name: "Indie 5-Pack",
    price: "$29",
    billing: "one-time",
    badge: "Most Popular",
    features: [
      "5 AI contract analysis credits",
      "Credits never expire",
      "Covers 7 commercial risk areas",
      "Local redaction and review are free",
    ],
    cta: "Buy 5-Pack",
    highlighted: true,
  },
] as const;

/**
 * Public pricing page — credit pack model (no subscriptions).
 */
export default function PricingPage(props: { searchParams: Promise<{ checkout?: string }> }) {
  return <Suspense fallback={<div className="p-10 text-center text-sm text-ink-light">Loading prices…</div>}>
    <PricingPageContent searchParams={props.searchParams} />
  </Suspense>;
}

async function PricingPageContent({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const checkoutState = (await searchParams).checkout;
  return (
    <div className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="mx-auto max-w-4xl w-full">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 font-serif text-4xl text-ink">
            Freelancer-Friendly Pricing
          </h1>
          <p className="font-serif text-lg text-ink-light">
            No expensive enterprise subscriptions. Pay only for the deals you
            shield.
          </p>
        </div>

        {checkoutState === "success" && <p role="status" className="mb-8 rounded-lg bg-sage p-4 text-center text-sm">Checkout completed. Credits are added only after Stripe confirms your purchase.</p>}
        {checkoutState === "cancelled" && <p role="status" className="mb-8 rounded-lg bg-amber p-4 text-center text-sm">Checkout was cancelled. No credits were charged.</p>}

        {/* Plans grid */}
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-8 md:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-8 shadow-sm ${
                plan.highlighted
                  ? "border-gray-800 bg-ink text-white shadow-lg"
                  : "border-gray-200 bg-white"
              }`}
            >
              {/* Badge */}
              {"badge" in plan && plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-terracotta-dark px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                  {plan.badge}
                </div>
              )}

              <h2
                className={`mb-2 text-xl font-bold ${
                  plan.highlighted ? "text-white" : "text-ink"
                }`}
              >
                {plan.name}
              </h2>

              <div
                className={`mb-6 font-serif text-4xl ${
                  plan.highlighted ? "text-white" : "text-ink"
                }`}
              >
                {plan.price}
                <span
                  className={`font-sans text-sm ${
                    plan.highlighted ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  {" "}
                  / {plan.billing}
                </span>
              </div>

              <ul
                className={`mb-8 flex-1 space-y-3 text-sm ${
                  plan.highlighted ? "text-gray-300" : "text-ink-light"
                }`}
              >
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <CheckoutButton pack={plan.id} next="/pricing">{plan.cta}</CheckoutButton>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-ink-light">Local PDF redaction and review are free. Credits are for AI contract analysis.</p>
      </div>
    </div>
  );
}
