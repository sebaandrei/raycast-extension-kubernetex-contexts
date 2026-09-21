import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("@raycast/api", () => ({
  showToast: mocks.showToast,
  Toast: { Style: { Success: "success", Failure: "failure" } },
}));

import { analyzeError, showErrorToast } from "../errors";
import { KubeconfigError, ValidationError } from "../kubeconfig-errors";

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.showToast.mockResolvedValue(undefined);
  consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe("showErrorToast", () => {
  it("shows typed KubeconfigError with its action and does not log", async () => {
    await showErrorToast(new KubeconfigError("m", "a"));
    expect(mocks.showToast).toHaveBeenCalledWith({ style: "failure", title: "Kubeconfig Error", message: "m\na" });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("has no trailing newline without an action", async () => {
    await showErrorToast(new KubeconfigError("m"));
    expect(mocks.showToast.mock.calls[0][0].message).toBe("m");
  });

  it("shows ValidationError as Validation Error", async () => {
    await showErrorToast(new ValidationError("bad", "fix"));
    expect(mocks.showToast).toHaveBeenCalledWith({ style: "failure", title: "Validation Error", message: "bad\nfix" });
  });

  it.each([
    ["a string", "boom"],
    ["undefined", undefined],
    ["an object", { code: 1 }],
    ["null", null],
  ])("does not throw for %s and logs it", async (_name, value) => {
    await expect(showErrorToast(value)).resolves.toBeUndefined();
    expect(mocks.showToast).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith("Unhandled error:", value);
  });

  it("routes an untyped Context not found error to the context branch", async () => {
    await showErrorToast(new Error('Context "x" not found'));
    expect(mocks.showToast.mock.calls[0][0].title).toBe("Context Not Found");
    expect(consoleError).toHaveBeenCalledWith("Unhandled error:", expect.any(Error));
  });

  it("does not reject when showToast rejects", async () => {
    mocks.showToast.mockRejectedValue(new Error("no toast"));
    await expect(showErrorToast(new Error("x"))).resolves.toBeUndefined();
  });

  it("does not reject when showToast throws synchronously", async () => {
    mocks.showToast.mockImplementation(() => {
      throw new Error("sync");
    });
    await expect(showErrorToast(new Error("x"))).resolves.toBeUndefined();
  });
});

describe("analyzeError", () => {
  it.each([
    ['Context "x" not found', "context", "Context Not Found"],
    ['context "x" does not exist', "context", "Context Not Found"],
    ['Context "x" already exists', "validation", "Context Already Exists"],
    ["ENOENT: no such file", "file", "Kubeconfig Not Found"],
    ["kubeconfig not found", "file", "Kubeconfig Not Found"],
    ["EACCES: denied", "permission", "Permission Denied"],
    ["permission denied", "permission", "Permission Denied"],
    ["bad yaml here", "yaml", "Invalid Kubeconfig"],
    ["could not parse", "yaml", "Invalid Kubeconfig"],
    ["name is required", "validation", "Validation Error"],
    ["cluster is broken", "kubeconfig", "Kubeconfig Error"],
    ["something else", "unknown", "Unexpected Error"],
  ])("maps %j to %s", (message, type, title) => {
    const result = analyzeError(new Error(message));
    expect(result.type).toBe(type);
    expect(result.title).toBe(title);
  });
});
