import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getItem: vi.fn(), setItem: vi.fn() }));
vi.mock("@raycast/api", () => ({ LocalStorage: { getItem: mocks.getItem, setItem: mocks.setItem } }));

import { getPreviousContext, rememberPreviousContext } from "../previous-context";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("previous context", () => {
  it("stores the context switched away from", async () => {
    await rememberPreviousContext("a", "b");
    expect(mocks.setItem).toHaveBeenCalledWith("previousContext", "a");
  });

  it("ignores missing or identical sources", async () => {
    await rememberPreviousContext(null, "b");
    await rememberPreviousContext("b", "b");
    expect(mocks.setItem).not.toHaveBeenCalled();
  });

  it("never throws when the write fails", async () => {
    mocks.setItem.mockRejectedValue(new Error("down"));
    await expect(rememberPreviousContext("a", "b")).resolves.toBeUndefined();
  });

  it("returns null when the read rejects or is not a string", async () => {
    mocks.getItem.mockRejectedValueOnce(new Error("down"));
    expect(await getPreviousContext()).toBeNull();
    mocks.getItem.mockResolvedValueOnce(42);
    expect(await getPreviousContext()).toBeNull();
    mocks.getItem.mockResolvedValueOnce(undefined);
    expect(await getPreviousContext()).toBeNull();
    mocks.getItem.mockResolvedValueOnce("x");
    expect(await getPreviousContext()).toBe("x");
  });
});
