import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeRedactedText } from "../server";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("analyzeRedactedText", () => {
  it("sends only the supplied redacted text and disables response storage", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "test-model");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ output: [
      { content: [{ type: "output_text", text: JSON.stringify({ findings: [{ trap: "payment_on_acceptance", severity: "critical", quote: "paid in 90 days", impact: "i", suggestion: "s", pushback_soft: "a", pushback_balanced: "b", pushback_firm: "c" }], not_found: ["broad_noncompete"] }) }] },
    ] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    await expect(analyzeRedactedText("[REDACTED_1] receives payment in 90 days.", controller.signal))
      .resolves.toEqual({ findings: [{ id: "f1", trap: "payment_on_acceptance", severity: "critical", quote: "paid in 90 days", impact: "i", suggestion: "s", pushback: { soft: "a", balanced: "b", firm: "c" } }], notFound: ["broad_noncompete"] });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(init.signal).toBe(controller.signal);
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "test-model", store: false,
      input: expect.arrayContaining([expect.objectContaining({
        role: "user", content: [{ type: "input_text", text: "[REDACTED_1] receives payment in 90 days." }],
      })]),
    });
  });
});
