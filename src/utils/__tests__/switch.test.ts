import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  closeMainWindow: vi.fn(),
  showHUD: vi.fn(),
  showToast: vi.fn(),
  setItem: vi.fn(),
  getItem: vi.fn(),
  showErrorToast: vi.fn(),
  getPreferences: vi.fn(),
}));

vi.mock("@raycast/api", () => ({
  closeMainWindow: mocks.closeMainWindow,
  showHUD: mocks.showHUD,
  showToast: mocks.showToast,
  Toast: { Style: { Success: "success", Failure: "failure", Animated: "animated" } },
  LocalStorage: { setItem: mocks.setItem, getItem: mocks.getItem },
}));
vi.mock("../errors", () => ({ showErrorToast: mocks.showErrorToast }));
vi.mock("../preferences", () => ({ getPreferences: mocks.getPreferences }));

import { KubeconfigError } from "../kubeconfig-errors";
import { formatSwitchMessage, switchAndClose } from "../switch";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPreferences.mockReturnValue({ closeAfterSwitch: true });
});

describe("formatSwitchMessage", () => {
  it("formats without namespace", () => {
    expect(formatSwitchMessage("prod-eu")).toBe("Switched to prod-eu");
  });
  it("formats with namespace", () => {
    expect(formatSwitchMessage("prod-eu", "kube-system")).toBe("Switched to prod-eu (namespace: kube-system)");
  });
});

describe("switchAndClose", () => {
  it("closes the window then shows a HUD when closeAfterSwitch is true", async () => {
    const order: string[] = [];
    mocks.closeMainWindow.mockImplementation(async () => void order.push("close"));
    mocks.showHUD.mockImplementation(async () => void order.push("hud"));
    const perform = vi.fn().mockResolvedValue(true);

    const ok = await switchAndClose(perform, { contextName: "b", namespace: "ns", fromContext: "a" });

    expect(ok).toBe(true);
    expect(perform).toHaveBeenCalledOnce();
    expect(order).toEqual(["close", "hud"]);
    expect(mocks.closeMainWindow).toHaveBeenCalledWith({ clearRootSearch: true });
    expect(mocks.showHUD).toHaveBeenCalledWith("Switched to b (namespace: ns)");
    expect(mocks.showToast).not.toHaveBeenCalled();
  });

  it("shows a success toast and stays open when closeAfterSwitch is false", async () => {
    mocks.getPreferences.mockReturnValue({ closeAfterSwitch: false });

    const ok = await switchAndClose(async () => true, { contextName: "b", fromContext: "a" });

    expect(ok).toBe(true);
    expect(mocks.showToast).toHaveBeenCalledWith({
      style: "success",
      title: "Context Switched",
      message: "Switched to b",
    });
    expect(mocks.closeMainWindow).not.toHaveBeenCalled();
    expect(mocks.showHUD).not.toHaveBeenCalled();
  });

  it("shows an error toast and returns false when perform throws", async () => {
    const err = new KubeconfigError("boom", "try again");

    const ok = await switchAndClose(() => Promise.reject(err), { contextName: "b", fromContext: "a" });

    expect(ok).toBe(false);
    expect(mocks.showErrorToast).toHaveBeenCalledWith(err);
    expect(mocks.showHUD).not.toHaveBeenCalled();
    expect(mocks.closeMainWindow).not.toHaveBeenCalled();
    expect(mocks.setItem).not.toHaveBeenCalled();
  });

  it("stores the previous context only when from is truthy and differs", async () => {
    await switchAndClose(async () => true, { contextName: "b", fromContext: "a" });
    expect(mocks.setItem).toHaveBeenCalledTimes(1);
    expect(mocks.setItem).toHaveBeenCalledWith(expect.any(String), "a");

    mocks.setItem.mockClear();
    await switchAndClose(async () => true, { contextName: "b", fromContext: "b" });
    await switchAndClose(async () => true, { contextName: "b", fromContext: null });
    await switchAndClose(async () => true, { contextName: "b" });
    expect(mocks.setItem).not.toHaveBeenCalled();
  });

  it("does not fail the switch when LocalStorage throws", async () => {
    mocks.setItem.mockRejectedValue(new Error("storage down"));

    const ok = await switchAndClose(async () => true, { contextName: "b", fromContext: "a" });

    expect(ok).toBe(true);
    expect(mocks.showHUD).toHaveBeenCalledWith("Switched to b");
  });
});
