import "server-only";
import { CREDIT_PACKS, getStripePriceId, type CreditPackId } from "./catalog";
import { getStripeClient } from "./stripe-client";
import { getAppBaseUrl } from "@/lib/app-url";

export async function createCreditCheckoutSession(user: { id: string; email?: string }, pack: CreditPackId) {
  const origin = getAppBaseUrl();
  const price = getStripePriceId(pack);
  const stripe = getStripeClient();
  const configuredPrice = await stripe.prices.retrieve(price);
  const packDetails = CREDIT_PACKS[pack];
  if (!configuredPrice.active || configuredPrice.unit_amount !== packDetails.amountCents
    || configuredPrice.currency !== packDetails.currency || configuredPrice.recurring) {
    throw new Error(`Stripe price does not match the configured ${pack} credit pack.`);
  }
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: user.id,
    customer_email: user.email,
    metadata: { user_id: user.id, credit_pack: pack, credit_count: String(CREDIT_PACKS[pack].credits) },
    success_url: new URL("/pricing?checkout=success", origin).toString(),
    cancel_url: new URL("/pricing?checkout=cancelled", origin).toString(),
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return session.url;
}
