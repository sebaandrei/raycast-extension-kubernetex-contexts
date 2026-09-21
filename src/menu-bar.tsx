import { Clipboard, Color, Icon, MenuBarExtra, open, showHUD } from "@raycast/api";
import { useMemo } from "react";
import { useKubeconfig } from "./hooks/useKubeconfig";
import { usePinnedRecent } from "./hooks/usePinnedRecent";
import { useProductionMatcher } from "./hooks/useProductionMatcher";
import { KubernetesContext } from "./types";
import { buildSections } from "./utils/context-sections";
import { getKubeconfigPath } from "./utils/kubeconfig-direct";
import { formatMenuBarTitle } from "./utils/menu-bar-title";
import { switchAndClose } from "./utils/switch";

const SUBMENU_THRESHOLD = 10;

// The menu bar has no window, so problems are reported with a HUD
async function reportHud(message: string, err: unknown) {
  console.error(`${message}:`, err);
  await showHUD(message).catch(() => undefined);
}

async function copyValue(label: string, value: string) {
  try {
    await Clipboard.copy(value);
    await showHUD(`Copied ${label}`);
  } catch (err) {
    await reportHud(`Could not copy ${label}`, err);
  }
}

// The menu bar has no file watcher: it reloads on the command interval (1m) and whenever it is opened.
export default function Command() {
  const { contexts, currentContext, isLoading, error, switchContext, refresh } = useKubeconfig();
  const { pinned, recent } = usePinnedRecent();
  const isProduction = useProductionMatcher();

  const sections = useMemo(() => buildSections({ contexts, pinned, recent }), [contexts, pinned, recent]);
  const current = contexts.find((c) => c.current) ?? contexts.find((c) => c.name === currentContext);

  const openKubeconfig = async () => {
    try {
      await open(getKubeconfigPath());
    } catch (err) {
      await reportHud("Could not open kubeconfig", err);
    }
  };
  const refreshMenu = async () => {
    try {
      await refresh();
    } catch (err) {
      await reportHud("Could not refresh contexts", err);
    }
  };
  const footer = (
    <MenuBarExtra.Section>
      <MenuBarExtra.Item title="Open Kubeconfig" icon={Icon.Document} onAction={openKubeconfig} />
      <MenuBarExtra.Item title="Refresh" icon={Icon.ArrowClockwise} onAction={refreshMenu} />
    </MenuBarExtra.Section>
  );

  if (error) {
    // Typed errors (KubeconfigError / ValidationError) carry a hint for the user
    const errorAction = "action" in error && typeof error.action === "string" ? error.action : undefined;
    return (
      <MenuBarExtra isLoading={isLoading} icon={Icon.Warning} title="Kubeconfig error" tooltip={error.message}>
        <MenuBarExtra.Section>
          <MenuBarExtra.Item title={error.message} />
          {errorAction && <MenuBarExtra.Item title={errorAction} />}
        </MenuBarExtra.Section>
        {footer}
      </MenuBarExtra>
    );
  }

  const renderContext = (context: KubernetesContext) => (
    <MenuBarExtra.Item
      key={context.name}
      title={context.name}
      subtitle={context.namespace}
      icon={context.current ? Icon.Check : undefined}
      onAction={() =>
        switchAndClose(() => switchContext(context.name), {
          contextName: context.name,
          namespace: undefined,
          fromContext: currentContext,
          closeWindow: false,
        })
      }
    />
  );

  const currentIsProd = !!currentContext && isProduction(currentContext);
  const icon = currentIsProd ? { source: Icon.Cloud, tintColor: Color.Red } : Icon.Cloud;
  const tooltip = currentContext
    ? `${currentContext}${current?.namespace ? ` (namespace: ${current.namespace})` : ""}`
    : "No current context";

  return (
    <MenuBarExtra isLoading={isLoading} icon={icon} title={formatMenuBarTitle(currentContext)} tooltip={tooltip}>
      {current && (
        <MenuBarExtra.Section title="Current">
          <MenuBarExtra.Item
            title={`Namespace: ${current.namespace ?? "default"}`}
            icon={Icon.Folder}
            tooltip="Copy namespace"
            onAction={() => copyValue("namespace", current.namespace ?? "default")}
          />
          <MenuBarExtra.Item
            title={`Cluster: ${current.cluster}`}
            icon={Icon.Network}
            tooltip="Copy cluster"
            onAction={() => copyValue("cluster", current.cluster)}
          />
        </MenuBarExtra.Section>
      )}
      {sections.pinned.length > 0 && (
        <MenuBarExtra.Section title="Pinned">{sections.pinned.map(renderContext)}</MenuBarExtra.Section>
      )}
      {sections.recent.length > 0 && (
        <MenuBarExtra.Section title="Recent">{sections.recent.map(renderContext)}</MenuBarExtra.Section>
      )}
      {sections.all.length > 0 && (
        <MenuBarExtra.Section title={sections.all.length > SUBMENU_THRESHOLD ? undefined : "All Contexts"}>
          {sections.all.length > SUBMENU_THRESHOLD ? (
            <MenuBarExtra.Submenu title="All Contexts" icon={Icon.List}>
              {sections.all.map(renderContext)}
            </MenuBarExtra.Submenu>
          ) : (
            sections.all.map(renderContext)
          )}
        </MenuBarExtra.Section>
      )}
      {footer}
    </MenuBarExtra>
  );
}
