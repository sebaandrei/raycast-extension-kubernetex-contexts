import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getItem: vi.fn(), setItem: vi.fn() }));
vi.mock("@raycast/api", () => ({ LocalStorage: { getItem: mocks.getItem, setItem: mocks.setItem } }));

import { getRecentNamespaces, rememberNamespace } from "../recent-namespaces";

let store: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  store = undefined;
  mocks.getItem.mockImplementation(async () => store);
  mocks.setItem.mockImplementation(async (_k: string, v: string) => void (store = v));
});

describe("recent namespaces", () => {
  it("returns an empty list when nothing is stored", async () => {
    expect(await getRecentNamespaces("a")).toEqual([]);
  });

  it("puts the most recent first and dedupes", async () => {
    await rememberNamespace("a", "one");
    await rememberNamespace("a", "two");
    await rememberNamespace("a", "one");
    expect(await getRecentNamespaces("a")).toEqual(["one", "two"]);
  });

  it("keeps at most 5 per context", async () => {
    for (const ns of ["n1", "n2", "n3", "n4", "n5", "n6"]) await rememberNamespace("a", ns);
    expect(await getRecentNamespaces("a")).toEqual(["n6", "n5", "n4", "n3", "n2"]);
  });

  it("keeps contexts separate under a single key", async () => {
    await rememberNamespace("a", "x");
    await rememberNamespace("b", "y");
    expect(await getRecentNamespaces("a")).toEqual(["x"]);
    expect(await getRecentNamespaces("b")).toEqual(["y"]);
    expect(new Set(mocks.setItem.mock.calls.map((c) => c[0])).size).toBe(1);
  });

  it("handles context names like __proto__", async () => {
    await rememberNamespace("__proto__", "x");
    expect(await getRecentNamespaces("__proto__")).toEqual(["x"]);
    expect(await getRecentNamespaces("constructor")).toEqual([]);
  });

  it("recovers from corrupt JSON", async () => {
    store = "{not json";
    expect(await getRecentNamespaces("a")).toEqual([]);
    await rememberNamespace("a", "x");
    expect(await getRecentNamespaces("a")).toEqual(["x"]);
  });

  it("ignores non-object payloads", async () => {
    store = "[1,2]";
    expect(await getRecentNamespaces("a")).toEqual([]);
  });

  it("never throws when storage fails", async () => {
    mocks.getItem.mockRejectedValue(new Error("down"));
    mocks.setItem.mockRejectedValue(new Error("down"));
    await expect(getRecentNamespaces("a")).resolves.toEqual([]);
    await expect(rememberNamespace("a", "x")).resolves.toBeUndefined();
  });

  it("does not overwrite stored data when the read fails", async () => {
    store = JSON.stringify({ a: ["one"] });
    mocks.getItem.mockRejectedValueOnce(new Error("down"));
    await rememberNamespace("b", "x");
    expect(mocks.setItem).not.toHaveBeenCalled();
    expect(await getRecentNamespaces("a")).toEqual(["one"]);
  });

  it("drops invalid, duplicate and excess entries from stored data", async () => {
    store = JSON.stringify({
      a: ["ok-1", "Bad_Name", "ok-1", 42, "", "ok-2", "ok-3", "ok-4", "ok-5", "ok-6"],
    });
    expect(await getRecentNamespaces("a")).toEqual(["ok-1", "ok-2", "ok-3", "ok-4", "ok-5"]);
  });
});
