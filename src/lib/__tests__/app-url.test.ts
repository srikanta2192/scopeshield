import { describe, expect, it } from "vitest";
import { getAppBaseUrl } from "../app-url";

describe("getAppBaseUrl", () => {
  it("accepts an HTTPS origin and localhost development URL", () => {
    expect(getAppBaseUrl("https://scope.example.com").origin).toBe("https://scope.example.com");
    expect(getAppBaseUrl("http://localhost:3000").origin).toBe("http://localhost:3000");
  });

  it.each([
    undefined,
    "not a URL",
    "http://scope.example.com",
    "https://user:secret@scope.example.com",
    "https://scope.example.com/path?next=/admin",
    "https://scope.example.com/#fragment",
  ])("rejects unsafe or invalid app URL %s", (value) => {
    expect(() => getAppBaseUrl(value)).toThrow();
  });
});
