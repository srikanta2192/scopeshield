import { describe, expect, it, vi } from "vitest";
import { createDocumentWorkflow } from "../workflow";
import type { DocumentSession, ParsedDocument } from "../types";

const document: ParsedDocument = {
  name: "contract.pdf",
  pages: [{ pageNumber: 1, text: "Contact alice@example.com", source: "embedded-text" }],
  updatedAt: 1,
};
const pdf = new Blob(["source PDF"]);
const session: DocumentSession = {
  id: "current", document,
  redactions: [{ value: "alice@example.com", replacement: "[REDACTED_1]", kind: "email" }],
  pdf, updatedAt: 2,
};

describe("document workflow", () => {
  it("persists a workspace only when the user opted in", async () => {
    const saveLocalSession = vi.fn().mockResolvedValue(undefined);
    const workflow = createDocumentWorkflow({
      loadLocalSession: vi.fn(), saveLocalSession, clearLocalSession: vi.fn(),
    });
    const snapshot = { document, redactions: session.redactions, pdf };

    await workflow.persist(false, snapshot);
    expect(saveLocalSession).not.toHaveBeenCalled();

    await workflow.persist(true, snapshot);
    expect(saveLocalSession).toHaveBeenCalledWith(snapshot);
  });

  it("restores undoable suggestions and builds the exact redacted text", async () => {
    const workflow = createDocumentWorkflow({
      loadLocalSession: vi.fn().mockResolvedValue(session),
      saveLocalSession: vi.fn(), clearLocalSession: vi.fn(),
    });

    await expect(workflow.restore(false)).resolves.toBeNull();
    const restored = await workflow.restore(true);
    expect(restored?.suggestions).toEqual([{
      value: "alice@example.com", replacement: "[REDACTED_1]", kind: "email", occurrences: 1,
    }]);
    expect(workflow.redactedText(document, session.redactions)).toBe("Contact [REDACTED_1]");
  });
});
