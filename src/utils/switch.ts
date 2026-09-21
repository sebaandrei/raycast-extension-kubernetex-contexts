import { Alert, closeMainWindow, confirmAlert, showHUD, showToast, Toast } from "@raycast/api";
import { getProductionMatcher } from "./environment";
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
}

export function formatSwitchMessage(contextName: string, namespace?: string): string {
  return namespace ? `Switched to ${contextName} (namespace: ${namespace})` : `Switched to ${contextName}`;
}

/**
 * Single entry point for "switch context, give feedback, close Raycast".
 * `perform` is the hook operation that actually switches. Never throws.
 */
export async function switchAndClose(perform: () => Promise<unknown>, opts: SwitchOptions): Promise<boolean> {
  try {
    if (opts.contextName !== opts.fromContext && getProductionMatcher().isProduction(opts.contextName)) {
      const confirmed = await confirmAlert({
        title: "Switch to production?",
        message: `"${opts.contextName}" looks like a production context. Subsequent kubectl and other commands will target it.`,
        primaryAction: { title: "Switch to Production", style: Alert.ActionStyle.Destructive },
      });
      if (!confirmed) return false;
    }
  } catch (err) {
    // Fail safe: without a confirmation the switch to production does not happen
    await showErrorToast(err as Error);
    return false;
  }

  try {
    const result = await perform();
    if (result === false) {
      throw new Error(`Could not switch to context "${opts.contextName}"`);
    }
  } catch (err) {
    await showErrorToast(err as Error);
    return false;
  }

  // The kubeconfig is already updated; feedback problems must not turn that into a failure
  try {
    await rememberPreviousContext(opts.fromContext, opts.contextName);
    await rememberContext(opts.contextName);
    if (opts.namespace) await rememberNamespace(opts.contextName, opts.namespace);

    const message = formatSwitchMessage(opts.contextName, opts.namespace);
    if (getPreferences().closeAfterSwitch) {
      await closeMainWindow({ clearRootSearch: true });
      await showHUD(message);
    } else {
      await showToast({ style: Toast.Style.Success, title: "Context Switched", message });
    }
  } catch (err) {
    console.error("Switched context but failed to show feedback:", err);
  }
  return true;
}
