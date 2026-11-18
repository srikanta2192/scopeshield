import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { fulfillPaidCheckout } from "@/lib/billing/fulfillment";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/billing/stripe-client";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  let stripe: ReturnType<typeof getStripeClient>;
  let webhookSecret: string;
  try {
    stripe = getStripeClient();
    webhookSecret = getStripeWebhookSecret();
  } catch {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }
  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe webhook." }, { status: 400 });
  }
  try {
    await fulfillPaidCheckout(event);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Credit fulfillment failed and Stripe may retry this event." }, { status: 500 });
  }
}
