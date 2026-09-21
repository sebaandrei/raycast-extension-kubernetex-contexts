import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getItem: vi.fn(), setItem: vi.fn() }));
vi.mock("@raycast/api", () => ({ LocalStorage: { getItem: mocks.getItem, setItem: mocks.setItem } }));

import { getPinnedContexts, getRecentContexts, rememberContext, togglePin } from "../recents";

let store: Record<string, string>;

beforeEach(() => {
  vi.clearAllMocks();
  store = {};
  mocks.getItem.mockImplementation(async (k: string) => store[k]);
  mocks.setItem.mockImplementation(async (k: string, v: string) => void (store[k] = v));
});

describe("recent contexts", () => {
  it("is empty by default, most recent first, deduped, capped at 5", async () => {
    expect(await getRecentContexts()).toEqual([]);
    for (const n of ["a", "b", "c", "d", "e", "f", "c"]) await rememberContext(n);
    expect(await getRecentContexts()).toEqual(["c", "f", "e", "d", "b"]);
  });

  it("sanitizes corrupt data on read", async () => {
    store["recent-contexts"] = JSON.stringify(["a", 1, null, "a", "", "b"]);
    expect(await getRecentContexts()).toEqual(["a", "b"]);
    store["recent-contexts"] = "not json";
    expect(await getRecentContexts()).toEqual([]);
    store["recent-contexts"] = JSON.stringify({ a: 1 });
    expect(await getRecentContexts()).toEqual([]);
  });

  it("never throws on storage failure", async () => {
    mocks.getItem.mockRejectedValue(new Error("down"));
    mocks.setItem.mockRejectedValue(new Error("down"));
    expect(await getRecentContexts()).toEqual([]);
    await expect(rememberContext("a")).resolves.toBeUndefined();
  });
});

describe("pinned contexts", () => {
  it("toggles in insertion order and returns the new state", async () => {
    expect(await togglePin("a")).toBe(true);
    expect(await togglePin("b")).toBe(true);
    expect(await getPinnedContexts()).toEqual(["a", "b"]);
    expect(await togglePin("a")).toBe(false);
    expect(await getPinnedContexts()).toEqual(["b"]);
  });

  it("stops pinning at 20", async () => {
    for (let i = 0; i < 20; i++) await togglePin(`c${i}`);
    expect(await togglePin("extra")).toBe(false);
    expect(await getPinnedContexts()).toHaveLength(20);
    expect(await getPinnedContexts()).not.toContain("extra");
  });

  it("never throws on storage failure", async () => {
    mocks.getItem.mockRejectedValue(new Error("down"));
    mocks.setItem.mockRejectedValue(new Error("down"));
    expect(await getPinnedContexts()).toEqual([]);
    expect(await togglePin("a")).toBe(false);
  });
});
