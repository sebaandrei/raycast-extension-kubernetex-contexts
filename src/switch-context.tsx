import { List, ActionPanel, Action } from "@raycast/api";
import { useKubeconfig } from "./hooks/useKubeconfig";
import { showSuccessToast, showErrorToast } from "./utils/errors";

export default function SwitchContext() {
  const { contexts, currentContext, isLoading, error, switchContext } = useKubeconfig();

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

  if (error) {
    return (
      <List>
        <List.Item
          title="Error Loading Contexts"
          subtitle={error.message}
          accessories={[{ text: "❌" }]}
        />
      </List>
    );
  }

  // Filter out current context since we're on a switch-specific screen
  const availableContexts = contexts.filter(ctx => !ctx.current);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search contexts to switch to...">
      <List.Item
        title={`Current: ${currentContext || "None"}`}
        subtitle="Currently active context"
        accessories={[{ text: "●" }]}
      />
      
      {availableContexts.map((context) => (
        <List.Item
          key={context.name}
          title={context.name}
          subtitle={`Cluster: ${context.cluster} • User: ${context.user}`}
          accessories={[
            { text: `ns: ${context.namespace || "default"}`, tooltip: "Namespace" }
          ]}
          actions={
            <ActionPanel>
              <Action
                title={`Switch to ${context.name}`}
                onAction={() => handleSwitchContext(context.name)}
              />
            </ActionPanel>
          }
        />
      ))}
      
      {availableContexts.length === 0 && contexts.length > 0 && !isLoading && (
        <List.Item
          title="No Other Contexts Available"
          subtitle="All available contexts are already current"
          accessories={[{ text: "ℹ️" }]}
        />
      )}
      
      {contexts.length === 0 && !isLoading && (
        <List.Item
          title="No Contexts Found"
          subtitle="Check your ~/.kube/config file"
          accessories={[{ text: "⚠️" }]}
        />
      )}
    </List>
  );
}
