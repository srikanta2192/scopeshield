import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearLocalSession, loadLocalSession, saveLocalSession } from "../session-store";

const DAY = 24 * 60 * 60 * 1000;
let now = 1_800_000_000_000;
let clock: ReturnType<typeof vi.spyOn>;

function deleteDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("scopeshield-local-sessions");
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("session database was not closed"));
  });
}

beforeEach(async () => {
  await deleteDatabase();
  now = 1_800_000_000_000;
  clock = vi.spyOn(Date, "now").mockImplementation(() => now);
});
afterEach(() => { clock.mockRestore(); });

const session = {
  document: { name: "contract.pdf", pages: [{ pageNumber: 1, text: "redacted text", source: "embedded-text" as const }], updatedAt: 0 },
  redactions: [{ value: "Private Name", replacement: "[REDACTED_1]" }],
  pdf: new Blob(["private PDF bytes"], { type: "application/pdf" }),
};

describe("local session expiry", () => {
  it("expires a saved session after seven days of inactivity", async () => {
    await saveLocalSession(session);
    now += 8 * DAY;
    await expect(loadLocalSession()).resolves.toBeNull();
    await clearLocalSession();
  });

  it("refreshes inactivity on resume, but expires after the next seven idle days", async () => {
    await saveLocalSession(session);
    now += 6 * DAY;
    await expect(loadLocalSession()).resolves.toMatchObject({ document: session.document });
    now += 6 * DAY;
    await expect(loadLocalSession()).resolves.toMatchObject({ document: session.document });
    now += 8 * DAY;
    await expect(loadLocalSession()).resolves.toBeNull();
  });
});
