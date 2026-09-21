import { describe, expect, it } from "vitest";
import { formatMenuBarTitle } from "../menu-bar-title";

describe("formatMenuBarTitle", () => {
  it("returns a neutral label for missing names", () => {
    expect(formatMenuBarTitle(null)).toBe("No context");
    expect(formatMenuBarTitle(undefined)).toBe("No context");
    expect(formatMenuBarTitle("")).toBe("No context");
  });
  it("keeps names up to the max length", () => {
    expect(formatMenuBarTitle("prod-eu")).toBe("prod-eu");
    expect(formatMenuBarTitle("a".repeat(24))).toBe("a".repeat(24));
  });
  it("truncates longer names to max characters including the ellipsis", () => {
    const out = formatMenuBarTitle("a".repeat(30));
    expect(out).toBe("a".repeat(23) + "…");
    expect(Array.from(out)).toHaveLength(24);
  });
  it("honours a custom max", () => {
    expect(formatMenuBarTitle("abcdefgh", 5)).toBe("abcd…");
  });
});
