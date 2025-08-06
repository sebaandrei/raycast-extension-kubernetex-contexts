import { Detail, ActionPanel, Action } from "@raycast/api";
import { useKubeconfig } from "./hooks/useKubeconfig";
import { showSuccessToast, showErrorToast } from "./utils/errors";

export default function KubeconfigTest() {
  const {
    kubeconfigInfo,
    isKubeconfigAvailable,
    currentContext,
    contexts,
    isLoading,
    error,
    switchContext,
    refresh,
  } = useKubeconfig();

  const handleSwitchContext = async (contextName: string) => {
    try {
      const success = await switchContext(contextName);
      if (success) {
        await showSuccessToast("Context Switched", `Switched to context: ${contextName}`);
      } else {
        await showErrorToast(new Error(`Failed to switch to context: ${contextName}`));
      }
    } catch (err) {
      await showErrorToast(err as Error);
    }
  };

  const markdown = `
# Kubeconfig Direct Test

## Kubeconfig File
- **Path**: ${kubeconfigInfo.path}
- **Available**: ${isKubeconfigAvailable ? "✅ Yes" : "❌ No"}
- **Total Contexts**: ${kubeconfigInfo.contextCount}

## Current Context
- **Active Context**: ${currentContext || "None set"}

## All Contexts
${contexts.length > 0 ? 
  contexts.map(ctx => 
    `- ${ctx.current ? "**" : ""}${ctx.name}${ctx.current ? "** (current)" : ""}\n  - Cluster: ${ctx.cluster}\n  - User: ${ctx.user}\n  - Namespace: ${ctx.namespace || "default"}`
  ).join('\n\n') : 
  "No contexts found"
}

## Technical Details
- **Loading**: ${isLoading ? "Yes" : "No"}
- **Error**: ${error?.message || "None"}

## Test Results
${isKubeconfigAvailable ? 
  "✅ **SUCCESS**: Kubeconfig file found and parsed successfully!" :
  "❌ **FAILED**: Kubeconfig file not found or not readable"
}

${contexts.length > 0 ?
  "✅ **SUCCESS**: Contexts loaded successfully!" :
  "❌ **FAILED**: No contexts found"
}

${currentContext ?
  `✅ **SUCCESS**: Current context detected: ${currentContext}` :
  "⚠️ **WARNING**: No current context set"
}

## Advantages of This Approach
- ✅ No kubectl command execution required
- ✅ No PATH or shell environment issues  
- ✅ Direct file manipulation is faster and more reliable
- ✅ Works even if kubectl is not installed
- ✅ No dependency on external binaries
  `;

  const contextActions = contexts
    .filter(ctx => !ctx.current) // Don't show action for current context
    .slice(0, 5) // Limit to 5 contexts to avoid cluttering
    .map(ctx => (
      <Action
        key={ctx.name}
        title={`Switch to ${ctx.name}`}
        onAction={() => handleSwitchContext(ctx.name)}
        shortcut={{ modifiers: ["cmd"], key: (contexts.indexOf(ctx) + 1).toString() as any }}
      />
    ));

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action
            title="Refresh Test"
            onAction={refresh}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
          />
          {contextActions}
        </ActionPanel>
      }
    />
  );
}