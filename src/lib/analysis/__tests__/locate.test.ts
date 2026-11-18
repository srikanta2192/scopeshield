import { describe, expect, it } from "vitest";
import { demoAnalysis } from "../demo";
import { locateAll, locateQuote, unredact } from "../locate";

describe("locateQuote", () => {
  const items = ["Client may transfer project IP upon", "delivery, before payment is", "complete."];
  it("finds a quote that spans text items, ignoring case and line breaks", () => {
    expect(locateQuote(items, "project ip upon  DELIVERY, before")).toEqual([
      { item: 0, from: 20, to: 35 }, { item: 1, from: 0, to: 16 },
    ]);
  });
  it("returns null when the quote is absent", () => {
    expect(locateQuote(items, "non-compete")).toBeNull();
  });
});

describe("locateAll", () => {
  it("returns every occurrence across items", () => {
    expect(locateAll(["Alice Smith and", "ALICE smith"], "alice smith")).toEqual([
      { item: 0, from: 0, to: 11 }, { item: 1, from: 0, to: 11 },
    ]);
  });
});

describe("unredact", () => {
  it("restores original values locally", () => {
    expect(unredact("[REDACTED_1] pays [REDACTED_10]", [
      { value: "Alice", replacement: "[REDACTED_1]" }, { value: "Bob", replacement: "[REDACTED_10]" },
    ])).toBe("Alice pays Bob");
  });
});

describe("demoAnalysis", () => {
  it("flags only traps whose quote is in the text and lists the rest as not found", () => {
    const r = demoAnalysis("Each party is responsible for its own acts and omissions.");
    expect(r.findings.map((f) => f.trap)).toEqual(["uncapped_liability"]);
    expect(r.notFound).toHaveLength(6);
  });
});
