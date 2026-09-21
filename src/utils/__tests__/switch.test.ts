import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  closeMainWindow: vi.fn(),
  showHUD: vi.fn(),
  showToast: vi.fn(),
  setItem: vi.fn(),
  getItem: vi.fn(),
  showErrorToast: vi.fn(),
  getPreferences: vi.fn(),
  confirmAlert: vi.fn(),
  rememberNamespace: vi.fn(),
  rememberContext: vi.fn(),
}));

vi.mock("@raycast/api", () => ({
  closeMainWindow: mocks.closeMainWindow,
  confirmAlert: mocks.confirmAlert,
  Alert: { ActionStyle: { Destructive: "destructive" } },
  showHUD: mocks.showHUD,
  showToast: mocks.showToast,
  Toast: { Style: { Success: "success", Failure: "failure", Animated: "animated" } },
  LocalStorage: { setItem: mocks.setItem, getItem: mocks.getItem },
}));
vi.mock("../errors", () => ({ showErrorToast: mocks.showErrorToast }));
vi.mock("../recent-namespaces", () => ({ rememberNamespace: mocks.rememberNamespace }));
vi.mock("../recents", () => ({ rememberContext: mocks.rememberContext }));
vi.mock("../preferences", () => ({ getPreferences: mocks.getPreferences }));

import { KubeconfigError } from "../kubeconfig-errors";
import { formatSwitchMessage, switchAndClose } from "../switch";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPreferences.mockReturnValue({ closeAfterSwitch: true });
  mocks.confirmAlert.mockResolvedValue(true);
  mocks.rememberContext.mockResolvedValue(undefined);
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

  it("skips closing and always shows a HUD when closeWindow is false", async () => {
    for (const closeAfterSwitch of [true, false]) {
      vi.clearAllMocks();
      mocks.getPreferences.mockReturnValue({ closeAfterSwitch });
      mocks.rememberContext.mockResolvedValue(undefined);
      mocks.confirmAlert.mockResolvedValue(true);

      const ok = await switchAndClose(async () => true, { contextName: "b", fromContext: "a", closeWindow: false });

      expect(ok).toBe(true);
      expect(mocks.closeMainWindow).not.toHaveBeenCalled();
      expect(mocks.showHUD).toHaveBeenCalledWith("Switched to b");
      expect(mocks.showToast).not.toHaveBeenCalled();
    }
  });

  it("closes as before when closeWindow is explicitly true", async () => {
    await switchAndClose(async () => true, { contextName: "b", fromContext: "a", closeWindow: true });
    expect(mocks.closeMainWindow).toHaveBeenCalledOnce();
    expect(mocks.showHUD).toHaveBeenCalledOnce();
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

  it("records the namespace only when one was given", async () => {
    await switchAndClose(async () => true, { contextName: "b", namespace: "ns", fromContext: "a" });
    expect(mocks.rememberNamespace).toHaveBeenCalledWith("b", "ns");

    mocks.rememberNamespace.mockClear();
    await switchAndClose(async () => true, { contextName: "b", fromContext: "a" });
    expect(mocks.rememberNamespace).not.toHaveBeenCalled();
  });

  it("does not record the namespace when the switch fails", async () => {
    await switchAndClose(async () => false, { contextName: "b", namespace: "ns", fromContext: "a" });
    expect(mocks.rememberNamespace).not.toHaveBeenCalled();
  });

  it("does not fail the switch when recording the namespace throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.rememberNamespace.mockRejectedValue(new Error("storage down"));

    const ok = await switchAndClose(async () => true, { contextName: "b", namespace: "ns", fromContext: "a" });

    expect(ok).toBe(true);
    expect(mocks.showErrorToast).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("records the context as recent on success only", async () => {
    await switchAndClose(async () => true, { contextName: "b", fromContext: "a" });
    expect(mocks.rememberContext).toHaveBeenCalledWith("b");

    mocks.rememberContext.mockClear();
    await switchAndClose(async () => false, { contextName: "b", fromContext: "a" });
    await switchAndClose(() => Promise.reject(new Error("x")), { contextName: "b", fromContext: "a" });
    mocks.confirmAlert.mockResolvedValue(false);
    await switchAndClose(async () => true, { contextName: "prod-eu", fromContext: "a" });
    expect(mocks.rememberContext).not.toHaveBeenCalled();
  });

  it("does not fail the switch when recording the recent context throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.rememberContext.mockRejectedValue(new Error("storage down"));

    const ok = await switchAndClose(async () => true, { contextName: "b", fromContext: "a" });

    expect(ok).toBe(true);
    expect(mocks.showErrorToast).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("treats a false result as a failed switch", async () => {
    const ok = await switchAndClose(async () => false, { contextName: "b", fromContext: "a" });

    expect(ok).toBe(false);
    expect(mocks.showErrorToast).toHaveBeenCalledOnce();
    expect(mocks.showHUD).not.toHaveBeenCalled();
    expect(mocks.setItem).not.toHaveBeenCalled();
  });

  it("still reports success when closing or the HUD fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.closeMainWindow.mockRejectedValue(new Error("no window"));

    const ok = await switchAndClose(async () => true, { contextName: "b", fromContext: "a" });

    expect(ok).toBe(true);
    expect(mocks.showErrorToast).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  describe("production guard", () => {
    beforeEach(() => {
      mocks.closeMainWindow.mockReset();
    });

    it("asks for confirmation and proceeds when confirmed", async () => {
      const perform = vi.fn().mockResolvedValue(true);

      const ok = await switchAndClose(perform, { contextName: "prod-eu", fromContext: "dev" });

      expect(ok).toBe(true);
      expect(mocks.confirmAlert).toHaveBeenCalledOnce();
      expect(mocks.confirmAlert.mock.calls[0][0].primaryAction).toEqual({
        title: "Switch to Production",
        style: "destructive",
      });
      expect(perform).toHaveBeenCalledOnce();
      expect(mocks.showHUD).toHaveBeenCalledWith("Switched to prod-eu");
    });

    it("does nothing and returns false when cancelled", async () => {
      mocks.confirmAlert.mockResolvedValue(false);
      const perform = vi.fn().mockResolvedValue(true);

      const ok = await switchAndClose(perform, { contextName: "prod-eu", fromContext: "dev" });

      expect(ok).toBe(false);
      expect(perform).not.toHaveBeenCalled();
      expect(mocks.showHUD).not.toHaveBeenCalled();
      expect(mocks.showToast).not.toHaveBeenCalled();
      expect(mocks.showErrorToast).not.toHaveBeenCalled();
      expect(mocks.closeMainWindow).not.toHaveBeenCalled();
    });

    it("does not switch and shows an error when the confirmation itself fails", async () => {
      mocks.confirmAlert.mockRejectedValue(new Error("alert failed"));
      const perform = vi.fn().mockResolvedValue(true);

      const ok = await switchAndClose(perform, { contextName: "prod-eu", fromContext: "dev" });

      expect(ok).toBe(false);
      expect(perform).not.toHaveBeenCalled();
      expect(mocks.showErrorToast).toHaveBeenCalledOnce();
      expect(mocks.showHUD).not.toHaveBeenCalled();
    });

    it("does not ask when the production context is already current", async () => {
      const ok = await switchAndClose(async () => true, { contextName: "prod-eu", fromContext: "prod-eu" });

      expect(ok).toBe(true);
      expect(mocks.confirmAlert).not.toHaveBeenCalled();
    });

    it("does not ask for non-production contexts", async () => {
      await switchAndClose(async () => true, { contextName: "staging", fromContext: "dev" });

      expect(mocks.confirmAlert).not.toHaveBeenCalled();
    });
  });
});
