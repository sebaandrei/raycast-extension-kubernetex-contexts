import { Detail, ActionPanel, Action, Keyboard } from "@raycast/api";
import { useKubeconfig } from "./hooks/useKubeconfig";
import { switchAndClose } from "./utils/switch";

export default function CurrentContext() {
  const { contexts, currentContext, kubeconfigInfo, isLoading, error, refresh, switchContext } = useKubeconfig();

  const currentCtx = contexts.find((ctx) => ctx.current);

  const generateMarkdown = () => {
    if (error) {
      return `
# Current Context - Error

❌ **Error loading kubeconfig**

\`\`\`
${error.message}
\`\`\`

## Troubleshooting
- Check if ~/.kube/config exists
- Verify file permissions
- Ensure valid YAML format
      `;
    }

    if (!currentContext) {
      return `
# No Current Context

⚠️ **No current context is set**

## Kubeconfig Information
- **File**: ${kubeconfigInfo.path}
- **Available**: ${kubeconfigInfo.available ? "✅ Yes" : "❌ No"}
- **Total Contexts**: ${kubeconfigInfo.contextCount}

## Available Contexts
${contexts.length > 0 ? contexts.map((ctx) => `- ${ctx.name} (${ctx.cluster})`).join("\n") : "No contexts found"}

*Use the "Kube Contexts" command to switch between contexts*
      `;
    }

    return `
# Current Context

## ✅ Active Context: **${currentContext}**

${
  currentCtx
    ? `
## Context Details
- **Name**: ${currentCtx.name}
- **Cluster**: ${currentCtx.cluster}
- **User**: ${currentCtx.user}
- **Namespace**: ${currentCtx.namespace || "default"}
- **Authentication**: ${currentCtx.userAuthMethod || "Unknown"}

## Cluster Information
${
  currentCtx.clusterDetails
    ? `
- **Server**: ${currentCtx.clusterDetails.server}
- **Hostname**: ${currentCtx.clusterDetails.hostname}
- **Port**: ${currentCtx.clusterDetails.port}
- **Protocol**: ${currentCtx.clusterDetails.protocol}
- **Security**: ${currentCtx.clusterDetails.isSecure ? "🔒 Secure" : "⚠️ Insecure"}
- **CA Certificate**: ${currentCtx.clusterDetails.hasCA ? "✅ Present" : "❌ Missing"}
`
    : "- **Server**: Unknown"
}

## File Information
- **Context File**: ${kubeconfigInfo.path}
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
            // Map index to valid KeyEquivalent values
            const keyMap = ["1", "2", "3", "4", "5"] as const;

            return (
              <Action
                key={ctx.name}
                title={`Switch to ${ctx.name}`}
                onAction={() => handleSwitchContext(ctx.name)}
                {...(index < 5 && {
                  shortcut: {
                    modifiers: ["cmd"] as const,
                    key: keyMap[index],
                  },
                })}
              />
            );
          })}
        </ActionPanel>
      }
    />
  );
}
