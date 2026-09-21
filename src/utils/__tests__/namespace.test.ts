import { describe, expect, it } from "vitest";
import { validateNamespace } from "../namespace";

describe("validateNamespace", () => {
  it.each(["default", "kube-system", "a", "0", "a-b-c", "team1", "a".repeat(63)])("accepts %s", (ns) => {
    expect(validateNamespace(ns)).toBeUndefined();
  });

  it.each([
    ["uppercase", "Default"],
    ["underscore", "my_ns"],
    ["leading hyphen", "-abc"],
    ["trailing hyphen", "abc-"],
    ["64 chars", "a".repeat(64)],
    ["empty", ""],
    ["whitespace only", "   "],
    ["inner whitespace", "a b"],
    ["surrounding whitespace", " abc "],
    ["dot", "a.b"],
  ])("rejects %s", (_label, ns) => {
    expect(validateNamespace(ns)).toEqual(expect.any(String));
  });
});
