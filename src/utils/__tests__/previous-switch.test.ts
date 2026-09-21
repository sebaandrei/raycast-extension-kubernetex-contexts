import { describe, expect, it } from "vitest";
import { resolvePreviousSwitch } from "../previous-switch";

const available = ["a", "b", "c"];

describe("resolvePreviousSwitch", () => {
  it("returns none when nothing is stored", () => {
    expect(resolvePreviousSwitch({ previous: null, current: "a", available })).toEqual({ kind: "none" });
    expect(resolvePreviousSwitch({ previous: undefined, current: "a", available })).toEqual({ kind: "none" });
    expect(resolvePreviousSwitch({ previous: "", current: "a", available })).toEqual({ kind: "none" });
  });

  it("returns missing when the stored context no longer exists", () => {
    expect(resolvePreviousSwitch({ previous: "gone", current: "a", available })).toEqual({
      kind: "missing",
      previous: "gone",
    });
  });

  it("returns same when previous equals current", () => {
    expect(resolvePreviousSwitch({ previous: "a", current: "a", available })).toEqual({ kind: "same", name: "a" });
  });

  it("returns switch otherwise", () => {
    expect(resolvePreviousSwitch({ previous: "b", current: "a", available })).toEqual({ kind: "switch", target: "b" });
  });

  it("switches when there is no current context", () => {
    expect(resolvePreviousSwitch({ previous: "b", current: null, available })).toEqual({ kind: "switch", target: "b" });
    expect(resolvePreviousSwitch({ previous: "b", current: undefined, available })).toEqual({
      kind: "switch",
      target: "b",
    });
  });
});
