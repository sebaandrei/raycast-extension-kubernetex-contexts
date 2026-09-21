import { describe, expect, it } from "vitest";
import { KubernetesContext } from "../../types";
import { buildSections } from "../context-sections";

const ctx = (name: string, current = false) => ({ name, current }) as KubernetesContext;
const names = (list: KubernetesContext[]) => list.map((c) => c.name);

describe("buildSections", () => {
  const contexts = [ctx("a"), ctx("b"), ctx("c", true), ctx("d")];

  it("returns everything in all when nothing is pinned or recent, current first", () => {
    const s = buildSections({ contexts, pinned: [], recent: [] });
    expect(names(s.pinned)).toEqual([]);
    expect(names(s.recent)).toEqual([]);
    expect(names(s.all)).toEqual(["c", "a", "b", "d"]);
  });

  it("keeps pin order and recency order", () => {
    const s = buildSections({ contexts, pinned: ["d", "a"], recent: ["b", "c"] });
    expect(names(s.pinned)).toEqual(["d", "a"]);
    expect(names(s.recent)).toEqual(["b", "c"]);
    expect(names(s.all)).toEqual([]);
  });

  it("excludes pinned contexts from recent", () => {
    const s = buildSections({ contexts, pinned: ["a"], recent: ["a", "b"] });
    expect(names(s.pinned)).toEqual(["a"]);
    expect(names(s.recent)).toEqual(["b"]);
    expect(names(s.all)).toEqual(["c", "d"]);
  });

  it("drops names that no longer exist", () => {
    const s = buildSections({ contexts, pinned: ["gone", "a"], recent: ["also-gone", "b"] });
    expect(names(s.pinned)).toEqual(["a"]);
    expect(names(s.recent)).toEqual(["b"]);
  });

  it("dedupes repeated names and never repeats a context across sections", () => {
    const s = buildSections({ contexts: [...contexts, ctx("a")], pinned: ["a", "a"], recent: ["b", "b", "a"] });
    const all = [...s.pinned, ...s.recent, ...s.all];
    expect(names(all).sort()).toEqual(["a", "b", "c", "d"]);
    expect(names(s.pinned)).toEqual(["a"]);
    expect(names(s.recent)).toEqual(["b"]);
  });

  it("handles empty contexts", () => {
    expect(buildSections({ contexts: [], pinned: ["a"], recent: ["b"] })).toEqual({ pinned: [], recent: [], all: [] });
  });

  it("puts the current context first in all when it is not pinned or recent", () => {
    const s = buildSections({ contexts, pinned: ["a"], recent: [] });
    expect(names(s.all)).toEqual(["c", "b", "d"]);
  });
});
