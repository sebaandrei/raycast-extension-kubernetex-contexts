import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  getPreferences: vi.fn(),
}));

vi.mock("@raycast/api", () => ({
  showToast: mocks.showToast,
  Toast: { Style: { Failure: "failure" } },
}));
vi.mock("../preferences", () => ({ getPreferences: mocks.getPreferences }));

import {
  compileProductionPattern,
  DEFAULT_PRODUCTION_PATTERN,
  getProductionMatcher,
  isProduction,
  reportInvalidPatternOnce,
} from "../environment";

beforeEach(() => {
  mocks.showToast.mockReset().mockResolvedValue(undefined);
  mocks.getPreferences.mockReset();
});

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

describe("getProductionMatcher", () => {
  it("matches using the preference and never shows a toast", () => {
    mocks.getPreferences.mockReturnValue({ productionPattern: "^prod-" });
    const matcher = getProductionMatcher();

    expect(matcher.valid).toBe(true);
    expect(matcher.isProduction("prod-eu")).toBe(true);
    expect(matcher.isProduction("my-prod")).toBe(false);
    expect(mocks.showToast).not.toHaveBeenCalled();
  });

  it("reports an invalid pattern without a side effect and falls back to the default", () => {
    mocks.getPreferences.mockReturnValue({ productionPattern: "(unclosed" });
    const matcher = getProductionMatcher();

    expect(matcher.valid).toBe(false);
    expect(matcher.isProduction("live-1")).toBe(true);
    expect(mocks.showToast).not.toHaveBeenCalled();
  });
});

describe("reportInvalidPatternOnce", () => {
  it("shows the toast only once per run", () => {
    reportInvalidPatternOnce();
    reportInvalidPatternOnce();

    expect(mocks.showToast).toHaveBeenCalledTimes(1);
    expect(mocks.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid production pattern" }));
  });
});
