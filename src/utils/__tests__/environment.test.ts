import { describe, expect, it, vi } from "vitest";

vi.mock("@raycast/api", () => ({
  showToast: vi.fn(),
  Toast: { Style: { Failure: "failure" } },
}));
vi.mock("../preferences", () => ({ getPreferences: vi.fn() }));

import { compileProductionPattern, DEFAULT_PRODUCTION_PATTERN, isProduction } from "../environment";

describe("compileProductionPattern", () => {
  it("uses the default for undefined or non-string values", () => {
    expect(compileProductionPattern(undefined).regex?.source).toBe(DEFAULT_PRODUCTION_PATTERN);
    expect(compileProductionPattern(42 as unknown as string)).toMatchObject({ valid: true });
  });
  it("disables detection for empty or whitespace patterns", () => {
    expect(compileProductionPattern("")).toEqual({ regex: null, valid: true });
    expect(compileProductionPattern("   ")).toEqual({ regex: null, valid: true });
  });
  it("falls back to the default for an invalid regex", () => {
    const result = compileProductionPattern("(unclosed");
    expect(result.valid).toBe(false);
    expect(result.regex?.source).toBe(DEFAULT_PRODUCTION_PATTERN);
  });
});

describe("isProduction", () => {
  it("matches the default pattern case-insensitively", () => {
    expect(isProduction("prod-eu")).toBe(true);
    expect(isProduction("PRD-1")).toBe(true);
    expect(isProduction("live-a")).toBe(true);
    expect(isProduction("staging")).toBe(false);
  });
  it("uses substring semantics", () => {
    expect(isProduction("product-dev")).toBe(true);
  });
  it("supports anchored custom patterns", () => {
    expect(isProduction("prod-eu", "^prod-")).toBe(true);
    expect(isProduction("my-prod-eu", "^prod-")).toBe(false);
  });
  it("is disabled by an empty pattern", () => {
    expect(isProduction("prod-eu", "")).toBe(false);
  });
  it("falls back to the default on an invalid regex", () => {
    expect(isProduction("prod-eu", "(unclosed")).toBe(true);
    expect(isProduction("staging", "(unclosed")).toBe(false);
  });
});
