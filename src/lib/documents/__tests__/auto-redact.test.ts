import { describe, expect, it } from "vitest";
import { applyRedactions, restoreRedactionSuggestions, suggestRedactions } from "../auto-redact";

describe("applyRedactions", () => {
  it("redacts repeated matches without regard to case", () => {
    expect(applyRedactions("Alice emailed ALICE.", [{ value: "Alice", replacement: "[PERSON_1]" }]))
      .toBe("[PERSON_1] emailed [PERSON_1].");
  });

  it("chooses the longest matching value and treats values literally", () => {
    expect(applyRedactions("A+B@Example.com Acme LLC", [
      { value: "acme", replacement: "[ORG]" },
      { value: "Acme LLC", replacement: "[ORG_2]" },
      { value: "A+B@Example.com", replacement: "[EMAIL]" },
    ])).toBe("[EMAIL] [ORG_2]");
  });

  it("does not redact text introduced by a replacement", () => {
    expect(applyRedactions("Alice", [
      { value: "Alice", replacement: "[REDACTED_1]" },
      { value: "REDACTED", replacement: "[OTHER]" },
    ])).toBe("[REDACTED_1]");
  });
});

describe("suggestRedactions", () => {
  it("suggests addresses and labeled identifiers while preserving currency amounts", async () => {
    const suggestions = await suggestRedactions([{ pageNumber: 1, source: "embedded-text", text: "Address: 123 Main Street, Portland. Account No: ACCT-123456. Fee: $1200000000." }]);
    expect(suggestions.some((item) => item.kind === "possible street address" && item.value.includes("123 Main Street"))).toBe(true);
    expect(suggestions.some((item) => item.kind === "labeled account or ID number" && item.value === "ACCT-123456")).toBe(true);
    expect(suggestions.some((item) => item.value.includes("1200000000"))).toBe(false);
  });

  it("suggests labeled names and organizations but preserves currency amounts", async () => {
    const suggestions = await suggestRedactions([{ pageNumber: 1, source: "embedded-text", text: "Client: Alice Smith. Company: Northwind Labs. Fee: USD 1200000000." }]);
    expect(suggestions.some((item) => item.value === "Alice Smith")).toBe(true);
    expect(suggestions.some((item) => item.value === "Northwind Labs")).toBe(true);
    expect(suggestions.some((item) => item.value.includes("1200000000"))).toBe(false);
  });

  it("suggests emails and repeats consistently across pages", async () => {
    const suggestions = await suggestRedactions([
      { pageNumber: 1, source: "embedded-text", text: "Contact alice@example.com." },
      { pageNumber: 2, source: "ocr", text: "Send a copy to alice@example.com." },
    ]);
    expect(suggestions).toContainEqual(expect.objectContaining({
      value: "alice@example.com", replacement: "[REDACTED_1]", kind: "email", occurrences: 2,
    }));
  });

  it("restores undoable automatic suggestions from saved rules and document pages", () => {
    expect(restoreRedactionSuggestions(
      [{ pageNumber: 1, text: "Contact alice@example.com", source: "embedded-text" }],
      [
        { value: "alice@example.com", replacement: "[REDACTED_1]", kind: "email" },
        { value: "manual phrase", replacement: "[REDACTED_2]", kind: "manual" },
      ],
    )).toEqual([
      { value: "alice@example.com", replacement: "[REDACTED_1]", kind: "email", occurrences: 1 },
    ]);
  });
});
