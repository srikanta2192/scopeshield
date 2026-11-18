import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { analyzeRedactedText } from "@/lib/analysis/server";
import { refundAnalysisCredit, reserveAnalysisCredit } from "@/lib/billing/credits";
import { POST } from "./route";

vi.mock("@/lib/supabase/auth", () => ({ getAuthenticatedUser: vi.fn() }));
vi.mock("@/lib/analysis/server", () => ({ analyzeRedactedText: vi.fn() }));
vi.mock("@/lib/billing/credits", () => ({
  refundAnalysisCredit: vi.fn(),
  reserveAnalysisCredit: vi.fn(),
}));

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("POST /api/analyze", () => {
  it("keeps AI analysis disabled until explicitly enabled", async () => {
    vi.stubEnv("ANALYSIS_ENABLED", "false");
    const response = await POST(new Request("http://localhost/api/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redactedText: "reviewed redacted content" }),
    }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Contract analysis is not enabled for this deployment." });
  });

  it("allows opt-in local analysis in development without an account or credit", async () => {
    vi.stubEnv("ANALYSIS_ENABLED", "false");
    vi.stubEnv("LOCAL_ANALYSIS_ENABLED", "true");
    vi.stubEnv("NODE_ENV", "development");
    vi.mocked(analyzeRedactedText).mockResolvedValue({ findings: [], notFound: [] });
    const response = await POST(new Request("http://localhost/api/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redactedText: "Reviewed [REDACTED] text" }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ findings: [], notFound: [] });
    expect(analyzeRedactedText).toHaveBeenCalledWith("Reviewed [REDACTED] text", expect.any(AbortSignal));
    expect(getAuthenticatedUser).not.toHaveBeenCalled();
    expect(reserveAnalysisCredit).not.toHaveBeenCalled();
  });

  it("does not allow the local analysis bypass in production", async () => {
    vi.stubEnv("ANALYSIS_ENABLED", "false");
    vi.stubEnv("LOCAL_ANALYSIS_ENABLED", "true");
    vi.stubEnv("NODE_ENV", "production");
    const response = await POST(new Request("http://localhost/api/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redactedText: "Reviewed text" }),
    }));
    expect(response.status).toBe(503);
    expect(getAuthenticatedUser).not.toHaveBeenCalled();
    expect(analyzeRedactedText).not.toHaveBeenCalled();
  });

  it("rejects requests without reviewed redacted text", async () => {
    vi.stubEnv("ANALYSIS_ENABLED", "true");
    vi.mocked(getAuthenticatedUser).mockResolvedValue({ id: "user-1" } as never);
    const response = await POST(new Request("http://localhost/api/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    }));
    expect(response.status).toBe(400);
    expect(reserveAnalysisCredit).not.toHaveBeenCalled();
  });

  it("rejects anonymous users before reading or charging their request", async () => {
    vi.stubEnv("ANALYSIS_ENABLED", "true");
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/analyze", {
      method: "POST", body: JSON.stringify({ redactedText: "reviewed text" }),
    }));
    expect(response.status).toBe(401);
    expect(reserveAnalysisCredit).not.toHaveBeenCalled();
    expect(analyzeRedactedText).not.toHaveBeenCalled();
  });

  it("does not call OpenAI without a credit and returns an actionable status", async () => {
    vi.stubEnv("ANALYSIS_ENABLED", "true");
    vi.mocked(getAuthenticatedUser).mockResolvedValue({ id: "user-1" } as never);
    vi.mocked(reserveAnalysisCredit).mockResolvedValue("no_credits");
    const response = await POST(new Request("http://localhost/api/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ redactedText: "redacted text" }),
    }));
    expect(response.status).toBe(402);
    expect(analyzeRedactedText).not.toHaveBeenCalled();
  });

  it("reserves one credit before sending only reviewed text and refunds on provider failure", async () => {
    vi.stubEnv("ANALYSIS_ENABLED", "true");
    vi.mocked(getAuthenticatedUser).mockResolvedValue({ id: "user-1" } as never);
    vi.mocked(reserveAnalysisCredit).mockResolvedValue("reserved");
    vi.mocked(analyzeRedactedText).mockRejectedValue(new Error("provider unavailable"));
    vi.mocked(refundAnalysisCredit).mockResolvedValue(undefined);
    const response = await POST(new Request("http://localhost/api/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redactedText: "[REDACTED]", filename: "private.pdf" }),
    }));
    expect(response.status).toBe(502);
    expect(reserveAnalysisCredit).toHaveBeenCalledWith("user-1", expect.any(String));
    expect(analyzeRedactedText).toHaveBeenCalledWith("[REDACTED]", expect.any(AbortSignal));
    expect(refundAnalysisCredit).toHaveBeenCalledWith("user-1", expect.any(String));
  });

  it("enforces the per-user request rate limit before calling OpenAI", async () => {
    vi.stubEnv("ANALYSIS_ENABLED", "true");
    vi.mocked(getAuthenticatedUser).mockResolvedValue({ id: "user-1" } as never);
    vi.mocked(reserveAnalysisCredit).mockResolvedValue("rate_limited");
    const response = await POST(new Request("http://localhost/api/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ redactedText: "redacted text" }),
    }));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(analyzeRedactedText).not.toHaveBeenCalled();
  });
});
