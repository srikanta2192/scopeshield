import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getCreditBalance } from "@/lib/billing/credits";
import { GET } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/auth", () => ({ getAuthenticatedUser: vi.fn() }));
vi.mock("@/lib/billing/credits", () => ({ getCreditBalance: vi.fn() }));
afterEach(() => vi.clearAllMocks());

describe("GET /api/billing/credits", () => {
  it("does not reveal a balance to an anonymous request", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(getCreditBalance).not.toHaveBeenCalled();
  });

  it("returns the balance for the verified session owner without caching", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue({ id: "user-1" } as never);
    vi.mocked(getCreditBalance).mockResolvedValue(4);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ balance: 4 });
    expect(getCreditBalance).toHaveBeenCalledWith("user-1");
  });
});
