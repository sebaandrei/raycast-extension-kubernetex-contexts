import { describe, expect, it } from "vitest";
import { escapeMarkdown } from "../markdown";

describe("escapeMarkdown", () => {
  it("leaves plain alphanumerics untouched", () => {
    expect(escapeMarkdown("prod cluster 1")).toBe("prod cluster 1");
  });

  it("escapes emphasis, code, link and heading characters", () => {
    expect(escapeMarkdown("a*b_c`d[e](f)#g")).toBe("a\\*b\\_c\\`d\\[e\\]\\(f\\)\\#g");
  });

  it("escapes backslashes and table pipes", () => {
    expect(escapeMarkdown("a\\b|c")).toBe("a\\\\b\\|c");
  });

  it("escapes characters common in server URLs", () => {
    expect(escapeMarkdown("https://x-y.io:6443")).toBe("https://x\\-y\\.io:6443");
  });

  it("collapses newlines", () => {
    expect(escapeMarkdown("a\nb")).toBe("a b");
  });
});
