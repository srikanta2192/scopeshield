import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createSession, retrievePrice } = vi.hoisted(() => ({ createSession: vi.fn(), retrievePrice: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../stripe-client", () => ({
  getStripeClient: () => ({ checkout: { sessions: { create: createSession } }, prices: { retrieve: retrievePrice } }),
}));

import { createCreditCheckoutSession } from "../checkout";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
beforeEach(() => retrievePrice.mockResolvedValue({ active: true, unit_amount: 2900, currency: "usd", recurring: null }));

describe("createCreditCheckoutSession", () => {
  it("creates a fixed server-priced one-time Checkout session with no document data", async () => {
    vi.stubEnv("APP_BASE_URL", "https://scopeshield.example");
    vi.stubEnv("STRIPE_PRICE_PACK", "price_server_pack");
    createSession.mockResolvedValue({ url: "https://checkout.stripe.com/session" });
    await expect(createCreditCheckoutSession({ id: "user-123", email: "user@example.com" }, "pack"))
      .resolves.toBe("https://checkout.stripe.com/session");
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      mode: "payment",
      line_items: [{ price: "price_server_pack", quantity: 1 }],
      client_reference_id: "user-123",
      metadata: { user_id: "user-123", credit_pack: "pack", credit_count: "5" },
      success_url: "https://scopeshield.example/pricing?checkout=success",
      cancel_url: "https://scopeshield.example/pricing?checkout=cancelled",
    }));
    const payload = JSON.stringify(createSession.mock.calls[0][0]);
    expect(payload).not.toMatch(/redactedText|filename|contract\.pdf/i);
  });

  it("rejects insecure non-local application URLs", async () => {
    vi.stubEnv("APP_BASE_URL", "http://scopeshield.example");
    vi.stubEnv("STRIPE_PRICE_SINGLE", "price_single");
    await expect(createCreditCheckoutSession({ id: "user-123" }, "single")).rejects.toThrow("HTTPS origin");
    expect(createSession).not.toHaveBeenCalled();
  });

  it("refuses a Stripe price that does not match the displayed pack price", async () => {
    vi.stubEnv("APP_BASE_URL", "https://scopeshield.example");
    vi.stubEnv("STRIPE_PRICE_PACK", "price_server_pack");
    retrievePrice.mockResolvedValue({ active: true, unit_amount: 100, currency: "usd", recurring: null });
    await expect(createCreditCheckoutSession({ id: "user-123" }, "pack")).rejects.toThrow("does not match");
    expect(createSession).not.toHaveBeenCalled();
  });
});
