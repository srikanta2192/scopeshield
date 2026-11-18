import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { retrieveSession, grantCredits } = vi.hoisted(() => ({
  retrieveSession: vi.fn(),
  grantCredits: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../stripe-client", () => ({
  getStripeClient: () => ({ checkout: { sessions: { retrieve: retrieveSession } } }),
}));
vi.mock("../credits", () => ({ grantPurchasedCredits: grantCredits }));

import { fulfillPaidCheckout } from "../fulfillment";

const userId = "7f9b0d3a-e4b0-4ec4-9e0c-b21766e4b733";
const event = (id: string, type = "checkout.session.completed") => ({
  id, type, data: { object: { id: "cs_test_123" } },
}) as unknown as Stripe.Event;

beforeEach(() => {
  vi.stubEnv("STRIPE_PRICE_SINGLE", "price_single");
  vi.stubEnv("STRIPE_PRICE_PACK", "price_pack");
  retrieveSession.mockResolvedValue({
    id: "cs_test_123", mode: "payment", payment_status: "paid", currency: "usd", amount_total: 2900,
    metadata: { user_id: userId, credit_pack: "pack", credit_count: "5" },
    line_items: { data: [{ price: { id: "price_pack", unit_amount: 2900, currency: "usd", recurring: null }, quantity: 1 }] },
  });
  grantCredits.mockResolvedValue(true);
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("fulfillPaidCheckout", () => {
  it("grants the server-configured credit amount for a paid configured pack", async () => {
    await expect(fulfillPaidCheckout(event("evt_paid"))).resolves.toBe(true);
    expect(retrieveSession).toHaveBeenCalledWith("cs_test_123", { expand: ["line_items"] });
    expect(grantCredits).toHaveBeenCalledWith({
      userId, credits: 5, checkoutSessionId: "cs_test_123", stripeEventId: "evt_paid",
    });
  });

  it("does not credit an unpaid or unrelated event", async () => {
    retrieveSession.mockResolvedValueOnce({ payment_status: "unpaid" });
    await expect(fulfillPaidCheckout(event("evt_unpaid"))).resolves.toBe(false);
    await expect(fulfillPaidCheckout(event("evt_other", "customer.updated"))).resolves.toBe(false);
    expect(grantCredits).not.toHaveBeenCalled();
  });

  it("rejects a paid session whose actual Stripe price differs from its pack metadata", async () => {
    retrieveSession.mockResolvedValueOnce({
      id: "cs_test_123", mode: "payment", payment_status: "paid", currency: "usd", amount_total: 2900,
      metadata: { user_id: userId, credit_pack: "pack", credit_count: "5" },
      line_items: { data: [{ price: { id: "price_single", unit_amount: 900, currency: "usd", recurring: null }, quantity: 1 }] },
    });
    await expect(fulfillPaidCheckout(event("evt_mismatch"))).rejects.toThrow("does not match a configured credit pack");
    expect(grantCredits).not.toHaveBeenCalled();
  });
});
