import { Detail, ActionPanel, Action, Keyboard } from "@raycast/api";
import { useKubeconfig } from "./hooks/useKubeconfig";
import { getKubeconfigPath } from "./utils/kubeconfig-direct";
import { escapeMarkdown } from "./utils/markdown";
import { switchAndClose } from "./utils/switch";

export default function CurrentContext() {
  const { contexts, currentContext, kubeconfigInfo, isLoading, error, refresh, switchContext } = useKubeconfig();

  const currentCtx = contexts.find((ctx) => ctx.current);

  const generateMarkdown = () => {
    // Avoid flashing the "No Current Context" body before the first read completes
    if (isLoading && !currentContext && !error) return "";

    if (error) {
      return `
# Current Context - Error

**Error loading kubeconfig**

\`\`\`
${error.message.replace(/`/g, "'")}
\`\`\`

## Troubleshooting
- Check if ${escapeMarkdown(getKubeconfigPath())} exists
- Verify file permissions
- Ensure valid YAML format
      `;
    }

    if (!currentContext) {
      return `
# No Current Context

**No current context is set**

## Kubeconfig Information
- **File**: ${escapeMarkdown(kubeconfigInfo.path)}
- **Available**: ${kubeconfigInfo.available ? "Yes" : "No"}
- **Total Contexts**: ${kubeconfigInfo.contextCount}

## Available Contexts
${contexts.length > 0 ? contexts.map((ctx) => `- ${escapeMarkdown(ctx.name)} (${escapeMarkdown(ctx.cluster)})`).join("\n") : "No contexts found"}

*Use the "Kube Contexts" command to switch between contexts*
      `;
    }

    return `
# Current Context

## Active Context: **${escapeMarkdown(currentContext)}**

${
  currentCtx
    ? `
## Context Details
- **Name**: ${escapeMarkdown(currentCtx.name)}
- **Cluster**: ${escapeMarkdown(currentCtx.cluster)}
- **User**: ${escapeMarkdown(currentCtx.user)}
- **Namespace**: ${escapeMarkdown(currentCtx.namespace || "default")}
- **Authentication**: ${escapeMarkdown(currentCtx.userAuthMethod || "Unknown")}

## Cluster Information
${
  currentCtx.clusterDetails
    ? `
- **Server**: ${escapeMarkdown(currentCtx.clusterDetails.server)}
- **Hostname**: ${escapeMarkdown(currentCtx.clusterDetails.hostname)}
- **Port**: ${escapeMarkdown(currentCtx.clusterDetails.port)}
- **Protocol**: ${escapeMarkdown(currentCtx.clusterDetails.protocol)}
- **Security**: ${currentCtx.clusterDetails.isSecure ? "Secure" : "Insecure"}
- **CA Certificate**: ${currentCtx.clusterDetails.hasCA ? "Present" : "Missing"}
`
    : "- **Server**: Unknown"
}

## File Information
- **Context File**: ${escapeMarkdown(kubeconfigInfo.path)}
- **Total Contexts Available**: ${kubeconfigInfo.contextCount}
`
    : ""
}

## Quick Actions
Use the actions below to manage your contexts quickly.
    `;
  };

  const otherContexts = contexts.filter((ctx) => !ctx.current).slice(0, 5);

  const handleSwitchContext = (contextName: string) =>
    switchAndClose(() => switchContext(contextName), { contextName, fromContext: currentContext });

  return (
    <Detail
      isLoading={isLoading}
      markdown={generateMarkdown()}
      actions={
        <ActionPanel>
          <Action title="Refresh" onAction={refresh} shortcut={Keyboard.Shortcut.Common.Refresh} />
          {otherContexts.map((ctx, index) => {
            const keyMap = ["1", "2", "3", "4", "5"] as const;

            return (
              <Action
                key={ctx.name}
                title={`Switch to ${ctx.name}`}
                onAction={() => handleSwitchContext(ctx.name)}
                shortcut={{ modifiers: ["cmd"], key: keyMap[index] }}
              />
            );
          })}
        </ActionPanel>
      }
    />
  );
}
