import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createCreditCheckoutSession } from "@/lib/billing/checkout";
import { POST } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/auth", () => ({ getAuthenticatedUser: vi.fn() }));
vi.mock("@/lib/billing/checkout", () => ({ createCreditCheckoutSession: vi.fn() }));
afterEach(() => vi.clearAllMocks());

describe("POST /api/billing/checkout", () => {
  it("requires a signed-in user before creating a Stripe session", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/billing/checkout", {
      method: "POST", body: JSON.stringify({ pack: "single" }),
    }));
    expect(response.status).toBe(401);
    expect(createCreditCheckoutSession).not.toHaveBeenCalled();
  });

  it("ignores client-supplied counts and prices", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue({ id: "user-1" } as never);
    vi.mocked(createCreditCheckoutSession).mockResolvedValue("https://checkout.example/session");
    const response = await POST(new Request("http://localhost/api/billing/checkout", {
      method: "POST", body: JSON.stringify({ pack: "pack", credits: 1000, price: "price_attacker" }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://checkout.example/session" });
    expect(createCreditCheckoutSession).toHaveBeenCalledWith({ id: "user-1", email: undefined }, "pack");
  });

  it("rejects unknown pack identifiers", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue({ id: "user-1" } as never);
    const response = await POST(new Request("http://localhost/api/billing/checkout", {
      method: "POST", body: JSON.stringify({ pack: "free" }),
    }));
    expect(response.status).toBe(400);
    expect(createCreditCheckoutSession).not.toHaveBeenCalled();
  });
});
