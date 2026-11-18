import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { inflateSync } from "node:zlib";
import { createRedactedPdf } from "../redacted-pdf";

describe("createRedactedPdf", () => {
  it("rebuilds a text-only PDF containing redacted text and generic metadata", async () => {
    const bytes = await createRedactedPdf({
      name: "private-client-contract.pdf",
      updatedAt: 1,
      pages: [{ pageNumber: 1, text: "Contact alice@example.com about the project.", source: "embedded-text" }],
    }, [{ value: "alice@example.com", replacement: "[REDACTED_1]" }]);
    const rebuilt = await PDFDocument.load(bytes);

    expect(rebuilt.getTitle()).toBe("ScopeShield Redacted Copy");
    expect(rebuilt.getAuthor()).toBe("ScopeShield");
    expect(rebuilt.getPageCount()).toBe(1);
    const pdfSource = Buffer.from(bytes).toString("latin1");
    const contentStreams = [...pdfSource.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
      .map((match) => inflateSync(Buffer.from(match[1], "latin1")).toString("latin1"))
      .join("\n").replace(/<([0-9A-F]+)>/g, (_, hex: string) => Buffer.from(hex, "hex").toString("latin1"));
    expect(contentStreams).toContain("[REDACTED_1]");
    expect(contentStreams).not.toContain("alice@example.com");
    expect(pdfSource).not.toContain("private-client-contract.pdf");
  });

  it("rejects characters that the embedded standard font cannot represent", async () => {
    await expect(createRedactedPdf({
      name: "contract.pdf",
      updatedAt: 1,
      pages: [{ pageNumber: 1, text: "नमस्ते", source: "embedded-text" }],
    }, [])).rejects.toThrow("This PDF contains characters the export font cannot represent.");
  });
});
