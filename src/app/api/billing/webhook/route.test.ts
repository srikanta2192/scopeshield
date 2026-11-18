import { afterEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { fulfillPaidCheckout } from "@/lib/billing/fulfillment";
import { POST } from "./route";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/billing/fulfillment", () => ({ fulfillPaidCheckout: vi.fn() }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

const stripe = new Stripe("sk_test_scopeshield_webhook_tests");
const webhookSecret = "whsec_scopeshield_webhook_tests";

describe("POST /api/billing/webhook", () => {
  it("rejects a request without a Stripe signature", async () => {
    const response = await POST(new Request("http://localhost/api/billing/webhook", { method: "POST", body: "{}" }));
    expect(response.status).toBe(400);
  });

  it("verifies the raw request body before fulfilling the signed event", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_scopeshield_webhook_tests");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", webhookSecret);
    const rawBody = JSON.stringify({ id: "evt_123", type: "customer.updated", data: { object: { id: "cus_123" } } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload: rawBody, secret: webhookSecret });
    vi.mocked(fulfillPaidCheckout).mockResolvedValue(true);
    const response = await POST(new Request("http://localhost/api/billing/webhook", {
      method: "POST", headers: { "stripe-signature": signature }, body: rawBody,
    }));
    expect(response.status).toBe(200);
    expect(fulfillPaidCheckout).toHaveBeenCalledWith(expect.objectContaining({ id: "evt_123", type: "customer.updated" }));
  });

  it("does not fulfill an invalid signature", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_scopeshield_webhook_tests");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", webhookSecret);
    const response = await POST(new Request("http://localhost/api/billing/webhook", {
      method: "POST", headers: { "stripe-signature": "t=1,v1=invalid" }, body: "{}",
    }));
    expect(response.status).toBe(400);
    expect(fulfillPaidCheckout).not.toHaveBeenCalled();
  });
});
