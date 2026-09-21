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

  it("does not overwrite stored recents when the read fails", async () => {
    store["recent-contexts"] = JSON.stringify(["a", "b"]);
    mocks.getItem.mockRejectedValueOnce(new Error("down"));
    await rememberContext("c");
    expect(mocks.setItem).not.toHaveBeenCalled();
    expect(await getRecentContexts()).toEqual(["a", "b"]);
  });

  it("resets corrupt JSON on the next write", async () => {
    store["recent-contexts"] = "not json";
    await rememberContext("a");
    expect(mocks.setItem).toHaveBeenCalledTimes(1);
    expect(await getRecentContexts()).toEqual(["a"]);
  });

  it("logs and survives a failing write", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.setItem.mockRejectedValue(new Error("full"));
    await expect(rememberContext("ctx-x")).resolves.toBeUndefined();
    expect(spy.mock.calls.some((c) => String(c[0]).includes("ctx-x"))).toBe(true);
    spy.mockRestore();
  });
});

describe("pinned contexts", () => {
  it("toggles in insertion order and returns the new state", async () => {
    expect(await togglePin("a")).toEqual({ ok: true, pinned: true });
    expect(await togglePin("b")).toEqual({ ok: true, pinned: true });
    expect(await getPinnedContexts()).toEqual(["a", "b"]);
    expect(await togglePin("a")).toEqual({ ok: true, pinned: false });
    expect(await getPinnedContexts()).toEqual(["b"]);
  });

  it("stops pinning at 20 and reports the limit", async () => {
    for (let i = 0; i < 20; i++) await togglePin(`c${i}`);
    expect(await togglePin("extra")).toEqual({ ok: false, reason: "limit" });
    expect(await getPinnedContexts()).toHaveLength(20);
    expect(await getPinnedContexts()).not.toContain("extra");
  });

  it("drops pins of contexts that no longer exist so they do not use the limit", async () => {
    for (let i = 0; i < 20; i++) await togglePin(`c${i}`);
    expect(await togglePin("new", ["new", "c0"])).toEqual({ ok: true, pinned: true });
    expect(await getPinnedContexts()).toEqual(["c0", "new"]);
  });

  it("reports storage failures instead of a successful unpin", async () => {
    mocks.getItem.mockRejectedValue(new Error("down"));
    mocks.setItem.mockRejectedValue(new Error("down"));
    expect(await getPinnedContexts()).toEqual([]);
    expect(await togglePin("a")).toEqual({ ok: false, reason: "storage" });
  });

  it("does not overwrite pins when the read fails", async () => {
    store["pinned-contexts"] = JSON.stringify(["a", "b"]);
    mocks.getItem.mockRejectedValueOnce(new Error("down"));
    expect(await togglePin("c")).toEqual({ ok: false, reason: "storage" });
    expect(mocks.setItem).not.toHaveBeenCalled();
    expect(await getPinnedContexts()).toEqual(["a", "b"]);
  });

  it("reports storage when the write fails", async () => {
    mocks.setItem.mockRejectedValue(new Error("full"));
    expect(await togglePin("a")).toEqual({ ok: false, reason: "storage" });
  });
});
