import { afterEach, describe, expect, it, vi } from "vitest";
import { requestContractAnalysis } from "../client";

afterEach(() => vi.unstubAllGlobals());

describe("requestContractAnalysis", () => {
  it("sends only approved redacted text through the app API and forwards cancellation", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ findings: [], notFound: [] }), {
      status: 200, headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestContractAnalysis("[REDACTED_1] must deliver in 30 days.", controller.signal))
      .resolves.toEqual({ findings: [], notFound: [] });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/analyze");
    expect(init.signal).toBe(controller.signal);
    expect(JSON.parse(String(init.body))).toEqual({ redactedText: "[REDACTED_1] must deliver in 30 days." });
  });

  it("preserves the account or credit error code for an actionable UI", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: "You need an analysis credit to continue.", code: "no_credits",
    }), { status: 402, headers: { "Content-Type": "application/json" } })));
    await expect(requestContractAnalysis("[REDACTED]")).rejects.toMatchObject({
      code: "no_credits", message: "You need an analysis credit to continue.",
    });
  });
});
