export type CreditPackId = "single" | "pack";

export const CREDIT_PACKS: Record<CreditPackId, { credits: number; amountCents: number; currency: "usd"; priceEnvironmentVariable: string }> = {
  single: { credits: 1, amountCents: 900, currency: "usd", priceEnvironmentVariable: "STRIPE_PRICE_SINGLE" },
  pack: { credits: 5, amountCents: 2_900, currency: "usd", priceEnvironmentVariable: "STRIPE_PRICE_PACK" },
};

export function parseCreditPack(value: unknown): CreditPackId | null {
  return value === "single" || value === "pack" ? value : null;
}

export function getStripePriceId(pack: CreditPackId, environment: Record<string, string | undefined> = process.env) {
  const priceId = environment[CREDIT_PACKS[pack].priceEnvironmentVariable];
  if (!priceId) throw new Error(`Stripe price is not configured for the ${pack} credit pack.`);
  return priceId;
}
