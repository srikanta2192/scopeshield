import { describe, expect, it } from "vitest";
import { getStripePriceId, parseCreditPack } from "../catalog";

describe("credit pack catalog", () => {
  it("allows only the published pack identifiers", () => {
    expect(parseCreditPack("single")).toBe("single");
    expect(parseCreditPack("pack")).toBe("pack");
    expect(parseCreditPack("free")).toBeNull();
    expect(parseCreditPack({ credits: 100 })).toBeNull();
  });

  it("resolves price identifiers only from server configuration", () => {
    expect(getStripePriceId("single", { STRIPE_PRICE_SINGLE: "price_single" })).toBe("price_single");
    expect(() => getStripePriceId("pack", {})).toThrow("Stripe price is not configured");
  });
});
