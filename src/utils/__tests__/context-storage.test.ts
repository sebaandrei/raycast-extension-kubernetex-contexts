import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getItem: vi.fn(), setItem: vi.fn() }));
vi.mock("@raycast/api", () => ({ LocalStorage: { getItem: mocks.getItem, setItem: mocks.setItem } }));

import { migrateContextName } from "../context-storage";

let store: Record<string, string>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  store = {};
  mocks.getItem.mockImplementation(async (k: string) => store[k]);
  mocks.setItem.mockImplementation(async (k: string, v: string) => void (store[k] = v));
});

describe("migrateContextName", () => {
  it("renames in pins (keeping order), recents, previous context and namespaces", async () => {
    store["pinned-contexts"] = JSON.stringify(["x", "old", "y"]);
    store["recent-contexts"] = JSON.stringify(["old", "z"]);
    store["previousContext"] = "old";
    store["recent-namespaces"] = JSON.stringify({ old: ["ns1", "ns2"], other: ["o"] });

    await migrateContextName("old", "new");

    expect(JSON.parse(store["pinned-contexts"])).toEqual(["x", "new", "y"]);
    expect(JSON.parse(store["recent-contexts"])).toEqual(["new", "z"]);
    expect(store["previousContext"]).toBe("new");
    expect(JSON.parse(store["recent-namespaces"])).toEqual({ other: ["o"], new: ["ns1", "ns2"] });
  });

  it("leaves unrelated data untouched and does not write", async () => {
    store["pinned-contexts"] = JSON.stringify(["a"]);
    store["previousContext"] = "a";
    store["recent-namespaces"] = JSON.stringify({ a: ["x"] });
    await migrateContextName("old", "new");
    expect(mocks.setItem).not.toHaveBeenCalled();
  });

  it("merges with entries already stored under the new name without duplicates", async () => {
    store["pinned-contexts"] = JSON.stringify(["new", "old"]);
    store["recent-namespaces"] = JSON.stringify({ new: ["a", "b"], old: ["b", "c"] });
    await migrateContextName("old", "new");
    expect(JSON.parse(store["pinned-contexts"])).toEqual(["new"]);
    expect(JSON.parse(store["recent-namespaces"])).toEqual({ new: ["a", "b", "c"] });
  });

  it("aborts quietly when storage cannot be read", async () => {
    mocks.getItem.mockRejectedValue(new Error("down"));
    await expect(migrateContextName("old", "new")).resolves.toBeUndefined();
    expect(mocks.setItem).not.toHaveBeenCalled();
  });

  it("never throws when writes fail", async () => {
    store["pinned-contexts"] = JSON.stringify(["old"]);
    mocks.setItem.mockRejectedValue(new Error("full"));
    await expect(migrateContextName("old", "new")).resolves.toBeUndefined();
  });

  it("ignores identical names", async () => {
    await migrateContextName("a", "a");
    expect(mocks.getItem).not.toHaveBeenCalled();
  });
});
