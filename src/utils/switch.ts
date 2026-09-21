import { closeMainWindow, showHUD, showToast, Toast } from "@raycast/api";
import { showErrorToast } from "./errors";
import { getPreferences } from "./preferences";
import { rememberPreviousContext } from "./previous-context";

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
  // Seam: a confirmation step (e.g. production guard) can be added here, before perform().
  try {
    await perform();
  } catch (err) {
    await showErrorToast(err as Error);
    return false;
  }

  await rememberPreviousContext(opts.fromContext, opts.contextName);

  const message = formatSwitchMessage(opts.contextName, opts.namespace);
  if (getPreferences().closeAfterSwitch) {
    await closeMainWindow({ clearRootSearch: true });
    await showHUD(message);
  } else {
    await showToast({ style: Toast.Style.Success, title: "Context Switched", message });
  }
  return true;
}
