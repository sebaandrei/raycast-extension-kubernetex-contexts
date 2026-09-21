import { Action, ActionPanel, Icon, Keyboard } from "@raycast/api";
import { KubernetesContext } from "../types";
import { buildKubectlCommand } from "../utils/kubectl-command";
import { getKubeconfigPath } from "../utils/kubeconfig-direct";

/** Copy and open actions shared by every context action panel. Place after the primary actions. */
export function ContextActions({ context }: { context: KubernetesContext }) {
  const server = context.clusterDetails?.server;
  const kubeconfigPath = getKubeconfigPath();
  return (
    <>
      <ActionPanel.Section title="Copy">
        <Action.CopyToClipboard
          title="Copy Context Name"
          content={context.name}
          shortcut={Keyboard.Shortcut.Common.CopyName}
        />
        {server && (
          <Action.CopyToClipboard
            title="Copy Server URL"
            content={server}
            shortcut={{ modifiers: ["cmd", "opt"], key: "s" }}
          />
        )}
        <Action.CopyToClipboard
          title="Copy Kubectl Command"
          content={buildKubectlCommand(context.name, context.namespace)}
          shortcut={{ modifiers: ["cmd", "opt"], key: "k" }}
        />
      </ActionPanel.Section>
      <ActionPanel.Section title="Kubeconfig">
        <Action.Open title="Open Kubeconfig" target={kubeconfigPath} icon={Icon.Document} />
        <Action.ShowInFinder title="Show Kubeconfig in Finder" path={kubeconfigPath} />
      </ActionPanel.Section>
    </>
  );
}
