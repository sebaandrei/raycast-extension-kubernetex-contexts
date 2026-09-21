import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useState } from "react";
import { validateNamespace } from "../utils/namespace";
import { getRecentNamespaces } from "../utils/recent-namespaces";

interface NamespaceSelectorProps {
  contextName: string;
  namespaces: string[];
  currentNamespace?: string;
  onSelect: (namespace: string) => void;
}

export function NamespaceSelector({ contextName, namespaces, currentNamespace, onSelect }: NamespaceSelectorProps) {
  const [searchText, setSearchText] = useState("");
  const { data: recents = [], isLoading } = usePromise(getRecentNamespaces, [contextName]);

  const recentNamespaces = recents.filter((ns) => ns !== currentNamespace);
  const otherNamespaces = namespaces.filter((ns) => ns !== currentNamespace && !recentNamespaces.includes(ns));

  const typed = searchText.trim();
  const isKnown = typed === currentNamespace || recents.includes(typed) || namespaces.includes(typed);
  const typedError = typed && !isKnown ? validateNamespace(typed) : undefined;
  const canUseTyped = typed !== "" && !isKnown && !typedError;

  const namespaceItem = (namespace: string, accessoryText?: string) => (
    <List.Item
      key={namespace}
      title={namespace}
      accessories={accessoryText ? [{ text: accessoryText }] : undefined}
      actions={
        <ActionPanel>
          <Action title={`Select ${namespace}`} onAction={() => onSelect(namespace)} />
        </ActionPanel>
      }
    />
  );

  return (
    <List
      isLoading={isLoading}
      filtering
      navigationTitle={`Namespace for ${contextName}`}
      searchBarPlaceholder="Search or type a namespace..."
      onSearchTextChange={setSearchText}
    >
      {typed !== "" && !isKnown && (
        <List.Section title="Custom">
          {canUseTyped ? (
            <List.Item
              key="custom-namespace"
              icon={Icon.Plus}
              title={`Use namespace "${typed}"`}
              keywords={[typed]}
              actions={
                <ActionPanel>
                  <Action title={`Use Namespace ${typed}`} icon={Icon.Plus} onAction={() => onSelect(typed)} />
                </ActionPanel>
              }
            />
          ) : (
            <List.Item
              key="invalid-namespace"
              icon={{ source: Icon.ExclamationMark, tintColor: Color.Red }}
              title={typedError ?? "Invalid namespace"}
              keywords={[typed]}
            />
          )}
        </List.Section>
      )}
      {currentNamespace && (
        <List.Section title="Current">{namespaceItem(currentNamespace, "Current namespace")}</List.Section>
      )}
      {recentNamespaces.length > 0 && (
        <List.Section title="Recent">{recentNamespaces.map((ns) => namespaceItem(ns))}</List.Section>
      )}
      <List.Section title="All Namespaces">{otherNamespaces.map((ns) => namespaceItem(ns))}</List.Section>
      <List.EmptyView icon={Icon.MagnifyingGlass} title="No Namespaces" description="Type a namespace name to use it" />
    </List>
  );
}
