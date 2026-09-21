import { List, ActionPanel, Action, Icon, showToast, Toast } from "@raycast/api";
import { useState, useMemo } from "react";
import { useKubeconfig } from "./hooks/useKubeconfig";
import { searchAndFilterContexts, addRecentContext, SearchFilters } from "./utils/search-filter";
import { switchAndClose } from "./utils/switch";
import { ContextDetails } from "./components/ContextDetails";

export default function ListContexts() {
  const { contexts, currentContext, isLoading, error, switchContext } = useKubeconfig();
  const [searchQuery, setSearchQuery] = useState("");

  // Apply search with advanced filtering
  const searchResults = useMemo(() => {
    const filters: SearchFilters = { query: searchQuery };
    return searchAndFilterContexts(contexts, filters);
  }, [contexts, searchQuery]);

  const handleSwitchContext = async (contextName: string) => {
    const switched = await switchAndClose(() => switchContext(contextName), {
      contextName,
      fromContext: currentContext,
    });
    if (switched) addRecentContext(contextName);
  };

  if (error) {
    return (
      <List>
        <List.Item title="Error Loading Contexts" subtitle={error.message} accessories={[{ text: "❌" }]} />
      </List>
    );
  }

  return (
    <List
      isLoading={isLoading}
      searchText={searchQuery}
      onSearchTextChange={setSearchQuery}
      searchBarPlaceholder="Search contexts by name, cluster, user, or namespace..."
    >
      {searchResults.map(({ context, relevanceScore, matchedFields }) => (
        <List.Item
          key={context.name}
          icon={context.current ? Icon.CheckCircle : Icon.Circle}
          title={context.name}
          subtitle={`Cluster: ${context.cluster} • User: ${context.user}${context.clusterDetails ? ` • ${context.clusterDetails.hostname}:${context.clusterDetails.port}` : ""}`}
          accessories={[
            {
              text: `ns: ${context.namespace || "default"}`,
              tooltip: "Namespace",
            },
            {
              text: context.userAuthMethod || "Unknown",
              tooltip: "Authentication Method",
            },
            ...(context.clusterDetails
              ? [
                  {
                    text: context.clusterDetails.protocol,
                    tooltip: `${context.clusterDetails.isSecure ? "Secure" : "Insecure"} connection`,
                  },
                ]
              : []),
            ...(searchQuery
              ? [
                  {
                    text: `${relevanceScore.toFixed(0)}%`,
                    tooltip: `Relevance (matched: ${matchedFields.join(", ")})`,
                  },
                ]
              : []),
            {
              text: context.current ? "●" : "",
              tooltip: context.current ? "Current context" : undefined,
            },
          ]}
          actions={
            <ActionPanel>
              {!context.current && (
                <Action
                  title={`Switch to ${context.name}`}
                  icon={Icon.ArrowRight}
                  onAction={() => handleSwitchContext(context.name)}
                />
              )}
              {context.current && (
                <Action
                  title="Current Context"
                  icon={Icon.CheckCircle}
                  onAction={() =>
                    showToast({
                      style: Toast.Style.Success,
                      title: "Current Context",
                      message: `Already using ${context.name}`,
                    })
                  }
                />
              )}
              <Action.Push
                title={`View ${context.name} Details`}
                icon={Icon.Info}
                target={<ContextDetails context={context} onSwitch={handleSwitchContext} />}
              />
            </ActionPanel>
          }
        />
      ))}
      {searchResults.length === 0 && !isLoading && (
        <List.Item
          title="No Matching Contexts"
          subtitle={searchQuery ? `No contexts match "${searchQuery}"` : "Check your ~/.kube/config file"}
          accessories={[{ text: searchQuery ? "🔍" : "⚠️" }]}
        />
      )}
    </List>
  );
}
