import { Detail, ActionPanel, Action } from "@raycast/api";
import { useKubeconfig } from "./hooks/useKubeconfig";
import { showSuccessToast, showErrorToast } from "./utils/errors";

export default function CurrentContext() {
  const { contexts, currentContext, kubeconfigInfo, isLoading, error, refresh, switchContext } = useKubeconfig();

  const currentCtx = contexts.find(ctx => ctx.current);

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
${contexts.length > 0 ? 
  contexts.map(ctx => `- ${ctx.name} (${ctx.cluster})`).join('\n') :
  "No contexts found"
}

*Use the "Switch Context" command to set an active context*
      `;
    }

    return `
# Current Context

## ✅ Active Context: **${currentContext}**

${currentCtx ? `
## Context Details
- **Name**: ${currentCtx.name}
- **Cluster**: ${currentCtx.cluster}
- **User**: ${currentCtx.user}
- **Namespace**: ${currentCtx.namespace || "default"}

## Cluster Information
- **Context File**: ${kubeconfigInfo.path}
- **Total Contexts Available**: ${kubeconfigInfo.contextCount}
` : ''}

## Quick Actions
Use the actions below to manage your contexts quickly.
    `;
  };

  const otherContexts = contexts.filter(ctx => !ctx.current).slice(0, 5);

  const handleSwitchContext = async (contextName: string) => {
    try {
      const success = await switchContext(contextName);
      if (success) {
        await showSuccessToast("Context Switched", `Switched to: ${contextName}`);
      }
    } catch (err) {
      await showErrorToast(err as Error);
    }
  };

  return (
    <Detail
      isLoading={isLoading}
      markdown={generateMarkdown()}
      actions={
        <ActionPanel>
          <Action
            title="Refresh"
            onAction={refresh}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
          />
          {otherContexts.map((ctx, index) => (
            <Action
              key={ctx.name}
              title={`Switch to ${ctx.name}`}
              onAction={() => handleSwitchContext(ctx.name)}
              shortcut={{ modifiers: ["cmd"], key: (index + 1).toString() as any }}
            />
          ))}
        </ActionPanel>
      }
    />
  );
}
