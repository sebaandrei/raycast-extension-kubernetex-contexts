import { Alert, closeMainWindow, confirmAlert, showHUD, showToast, Toast } from "@raycast/api";
import { getProductionMatcher, reportInvalidPatternOnce } from "./environment";
import { showErrorToast } from "./errors";
import { getPreferences } from "./preferences";
import { rememberPreviousContext } from "./previous-context";
import { rememberNamespace } from "./recent-namespaces";
import { rememberContext } from "./recents";

export interface SwitchOptions {
  contextName: string;
  namespace?: string;
  /** Context that is active before the switch (used for "switch back"). */
  fromContext?: string | null;
  /**
   * false (menu bar): never close the window, always show a HUD. Otherwise follow the
   * "Close Raycast After Switching" preference: close + HUD when on, success toast when off.
   */
  closeWindow?: boolean;
}

export function formatSwitchMessage(contextName: string, namespace?: string): string {
  return namespace ? `Switched to ${contextName} (namespace: ${namespace})` : `Switched to ${contextName}`;
}

/** Failures without a window (menu bar) go to a HUD, which is visible; otherwise a toast. */
async function reportFailure(err: unknown, opts: SwitchOptions): Promise<void> {
  if (opts.closeWindow === false) {
    console.error("Context switch failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    try {
      await showHUD(`Failed: ${message}`);
    } catch {
      // nothing left to try
    }
    return;
  }
  try {
    await showErrorToast(err);
  } catch (toastErr) {
    console.error("Failed to show error toast:", toastErr);
  }
}

/**
 * Single entry point for "switch context, give feedback, close Raycast".
 * `perform` is the hook operation that actually switches. Resolves to false on failure or
 * cancellation; the production confirmation is skipped when contextName === fromContext.
 * Never rejects: every failure is caught and reported.
 */
export async function switchAndClose(perform: () => Promise<unknown>, opts: SwitchOptions): Promise<boolean> {
  try {
    const matcher = getProductionMatcher();
    if (!matcher.valid) reportInvalidPatternOnce();
    if (opts.contextName !== opts.fromContext && matcher.isProduction(opts.contextName)) {
      const confirmed = await confirmAlert({
        title: "Switch to production?",
        message: `"${opts.contextName}" looks like a production context. Subsequent kubectl and other commands will target it.`,
        primaryAction: { title: "Switch to Production", style: Alert.ActionStyle.Destructive },
      });
      if (!confirmed) return false;
    }
  } catch (err) {
    // Fail safe: without a confirmation the switch to production does not happen
    await reportFailure(err, opts);
    return false;
  }

  try {
    const result = await perform();
    if (result === false) {
      throw new Error(`Could not switch to context "${opts.contextName}"`);
    }
  } catch (err) {
    await reportFailure(err, opts);
    return false;
  }

  // The kubeconfig is already updated; feedback problems must not turn that into a failure
  const message = formatSwitchMessage(opts.contextName, opts.namespace);
  try {
    await rememberPreviousContext(opts.fromContext, opts.contextName);
    await rememberContext(opts.contextName);
    if (opts.namespace) await rememberNamespace(opts.contextName, opts.namespace);

    if (opts.closeWindow === false) {
      await showHUD(message);
    } else if (getPreferences().closeAfterSwitch) {
      await closeMainWindow({ clearRootSearch: true });
      await showHUD(message);
    } else {
      await showToast({ style: Toast.Style.Success, title: "Context Switched", message });
    }
  } catch (err) {
    console.error(`Switched to ${opts.contextName} but failed to show feedback:`, err);
    // Best-effort confirmation so the user still learns that the switch worked
    try {
      await showToast({ style: Toast.Style.Success, title: "Context Switched", message });
    } catch {
      // nothing left to try
    }
  }
  return true;
}
