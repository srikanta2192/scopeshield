import "server-only";
import type Stripe from "stripe";
import { CREDIT_PACKS, getStripePriceId, parseCreditPack } from "./catalog";
import { grantPurchasedCredits } from "./credits";
import { getStripeClient } from "./stripe-client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function fulfillPaidCheckout(event: Stripe.Event) {
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") return false;
  const checkoutEvent = event.data.object as Stripe.Checkout.Session;
  if (!checkoutEvent.id) throw new Error("The Checkout event did not include a session id.");

  const session = await getStripeClient().checkout.sessions.retrieve(checkoutEvent.id, { expand: ["line_items"] });
  if (session.mode !== "payment" || session.payment_status !== "paid") return false;
  const userId = session.metadata?.user_id;
  const pack = parseCreditPack(session.metadata?.credit_pack);
  if (!userId || !UUID.test(userId) || !pack) throw new Error("The paid Checkout session has invalid ScopeShield metadata.");

  const lineItems = session.line_items?.data ?? [];
  const priceId = getStripePriceId(pack);
  const linePrice = lineItems[0]?.price;
  if (lineItems.length !== 1 || lineItems[0].quantity !== 1 || typeof linePrice === "string"
    || linePrice?.id !== priceId || linePrice.unit_amount !== CREDIT_PACKS[pack].amountCents
    || linePrice.currency !== CREDIT_PACKS[pack].currency || linePrice.recurring
    || session.currency !== CREDIT_PACKS[pack].currency || session.amount_total !== CREDIT_PACKS[pack].amountCents) {
    throw new Error("The paid Checkout session does not match a configured credit pack.");
  }
  if (Number(session.metadata?.credit_count) !== CREDIT_PACKS[pack].credits) {
    throw new Error("The paid Checkout session has an invalid credit amount.");
  }

  return grantPurchasedCredits({
    userId,
    credits: CREDIT_PACKS[pack].credits,
    checkoutSessionId: session.id,
    stripeEventId: event.id,
  });
}
