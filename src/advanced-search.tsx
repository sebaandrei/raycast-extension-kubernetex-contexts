import { List, ActionPanel, Action, Icon } from "@raycast/api";
import { useState, useMemo } from "react";
import { useKubeconfig } from "./hooks/useKubeconfig";
import { showSuccessToast, showErrorToast } from "./utils/errors";
import { 
  searchAndFilterContexts, 
  getFilterOptions, 
  highlightMatches, 
  getRecentContexts,
  addRecentContext,
  SearchFilters 
} from "./utils/search-filter";

export default function AdvancedSearch() {
  const { contexts, currentContext, isLoading, error, switchContext } = useKubeconfig();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCluster, setSelectedCluster] = useState<string>("");
  const [selectedNamespace, setSelectedNamespace] = useState<string>("");
  const [showOnlyCurrent, setShowOnlyCurrent] = useState(false);
  const [showOnlyWithNamespace, setShowOnlyWithNamespace] = useState(false);

  const recentContexts = useMemo(() => getRecentContexts(), [contexts]);
  const filterOptions = useMemo(() => getFilterOptions(contexts), [contexts]);

  // Create search filters
  const filters: SearchFilters = {
    query: searchQuery,
    cluster: selectedCluster || undefined,
    namespace: selectedNamespace || undefined,
    showOnlyCurrent,
    showOnlyWithNamespace,
  };

  // Apply search and filtering
  const searchResults = useMemo(() => {
    return searchAndFilterContexts(contexts, filters);
  }, [contexts, filters]);

  const handleSwitchContext = async (contextName: string) => {
    try {
      const success = await switchContext(contextName);
      if (success) {
        addRecentContext(contextName);
        await showSuccessToast("Context Switched", `Switched to: ${contextName}`);
      }
    } catch (err) {
      await showErrorToast(err as Error);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCluster("");
    setSelectedNamespace("");
    setShowOnlyCurrent(false);
    setShowOnlyWithNamespace(false);
  };

  const hasActiveFilters = selectedCluster || selectedNamespace || showOnlyCurrent || showOnlyWithNamespace;

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

  return (
    <List
      isLoading={isLoading}
      searchText={searchQuery}
      onSearchTextChange={setSearchQuery}
      searchBarPlaceholder="Search contexts by name, cluster, user, or namespace..."
      searchBarAccessory={
        <List.Dropdown
          tooltip="Quick Filters"
          storeValue={true}
          onChange={(value) => {
            if (value === "current") {
              setShowOnlyCurrent(true);
              setShowOnlyWithNamespace(false);
            } else if (value === "with-namespace") {
              setShowOnlyWithNamespace(true);
              setShowOnlyCurrent(false);
            } else {
              setShowOnlyCurrent(false);
              setShowOnlyWithNamespace(false);
            }
          }}
        >
          <List.Dropdown.Item title="All Contexts" value="" />
          <List.Dropdown.Item title="Current Context Only" value="current" />
          <List.Dropdown.Item title="With Namespace Only" value="with-namespace" />
        </List.Dropdown>
      }
    >
      {/* Recent Contexts Section */}
      {recentContexts.length > 0 && !searchQuery && !hasActiveFilters && (
        <List.Section title="Recent Contexts">
          {recentContexts.map((contextName, index) => {
            const context = contexts.find(ctx => ctx.name === contextName);
            if (!context) return null;
            
            return (
              <List.Item
                key={`recent-${contextName}`}
                icon={context.current ? Icon.CheckCircle : Icon.Clock}
                title={context.name}
                subtitle={`Cluster: ${context.cluster} • User: ${context.user}`}
                accessories={[
                  { text: `ns: ${context.namespace || "default"}`, tooltip: "Namespace" },
                  { text: `#${index + 1}`, tooltip: "Recent rank" },
                  { text: context.current ? "●" : "", tooltip: context.current ? "Current context" : undefined }
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
                        onAction={() => showSuccessToast("Current Context", `Already using ${context.name}`)}
                      />
                    )}
                  </ActionPanel>
                }
              />
            );
          })}
        </List.Section>
      )}

      {/* Search Results Section */}
      <List.Section
        title={searchQuery || hasActiveFilters ? `Search Results (${searchResults.length})` : "All Contexts"}
        subtitle={hasActiveFilters ? "Filtered results" : undefined}
      >
        {searchResults.map(({ context, relevanceScore, matchedFields }, index) => (
          <List.Item
            key={context.name}
            icon={context.current ? Icon.CheckCircle : Icon.Circle}
            title={highlightMatches(context.name, searchQuery)}
            subtitle={`Cluster: ${highlightMatches(context.cluster, searchQuery)} • User: ${highlightMatches(context.user, searchQuery)}`}
            accessories={[
              { text: `ns: ${context.namespace || "default"}`, tooltip: "Namespace" },
              { text: `${relevanceScore.toFixed(0)}%`, tooltip: `Relevance score (matched: ${matchedFields.join(", ")})` },
              { text: context.current ? "●" : "", tooltip: context.current ? "Current context" : undefined }
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
                    onAction={() => showSuccessToast("Current Context", `Already using ${context.name}`)}
                  />
                )}
                {hasActiveFilters && (
                  <Action
                    title="Clear All Filters"
                    icon={Icon.XMarkCircle}
                    onAction={clearFilters}
                    shortcut={{ modifiers: ["cmd"], key: "k" }}
                  />
                )}
              </ActionPanel>
            }
          />
        ))}
      </List.Section>

      {searchResults.length === 0 && !isLoading && (
        <List.Item
          title="No Matching Contexts"
          subtitle={searchQuery ? `No contexts match "${searchQuery}"${hasActiveFilters ? " with current filters" : ""}` : "No contexts found"}
          accessories={[{ text: "🔍" }]}
          actions={
            <ActionPanel>
              {hasActiveFilters && (
                <Action
                  title="Clear All Filters"
                  icon={Icon.XMarkCircle}
                  onAction={clearFilters}
                />
              )}
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}