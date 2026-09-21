import { showHUD } from "@raycast/api";
import { showErrorToast } from "./utils/errors";
import { getAllContexts, getCurrentContext, switchToContext } from "./utils/kubeconfig-direct";
import { getPreviousContext } from "./utils/previous-context";
import { resolvePreviousSwitch } from "./utils/previous-switch";
import { switchAndClose } from "./utils/switch";

export default async function Command() {
  let result;
  let current: string | null;
  try {
    const previous = await getPreviousContext();
    current = getCurrentContext();
    const available = getAllContexts().map((c) => c.name);
    result = resolvePreviousSwitch({ previous, current, available });
  } catch (err) {
    await showErrorToast(err as Error);
    return;
  }

  switch (result.kind) {
    case "none":
      await showHUD("No previous context yet");
      return;
    case "missing":
      await showHUD(`Previous context "${result.previous}" no longer exists`);
      return;
    case "same":
      await showHUD(`Already on ${result.name}`);
      return;
    case "switch": {
      const target = result.target;
      await switchAndClose(async () => switchToContext(target), { contextName: target, fromContext: current });
      return;
    }
  }
}
