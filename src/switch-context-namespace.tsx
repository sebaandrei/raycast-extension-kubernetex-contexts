import { useMemo, useState } from "react";
import { List, ActionPanel, Action, useNavigation, Icon } from "@raycast/api";
import { useKubeconfig } from "./hooks/useKubeconfig";
import { NamespaceSelector } from "./components/NamespaceSelector";
import { switchAndClose } from "./utils/switch";
import { KubeconfigEmptyView } from "./components/KubeconfigEmptyView";
import { ContextDetails } from "./components/ContextDetails";
import {
  contextIcon,
  contextKeywords,
  contextSubtitle,
  prodAccessory,
  providerAccessory,
  serverLabel,
} from "./components/context-visuals";
import { useProductionMatcher } from "./hooks/useProductionMatcher";
import { usePinnedRecent } from "./hooks/usePinnedRecent";
import { buildSections } from "./utils/context-sections";
import { ContextActions } from "./components/ContextActions";
import { KubernetesContext } from "./types";

export default function SwitchContextWithNamespace() {
  const { contexts, currentContext, namespaces, isLoading, error, refresh, switchContextWithNamespace } =
    useKubeconfig();
  const [searchText, setSearchText] = useState("");
  const { push } = useNavigation();
  const handleContextSelect = (contextName: string) => {
    const context = contexts.find((ctx) => ctx.name === contextName);

    push(
      <NamespaceSelector
        contextName={contextName}
        namespaces={namespaces}
        currentNamespace={context?.namespace}
        onSelect={(namespace) => handleNamespaceSelect(contextName, namespace)}
      />
    );
  };

  const handleNamespaceSelect = (contextName: string, namespace: string) =>
    switchAndClose(() => switchContextWithNamespace(contextName, namespace), {
      contextName,
      namespace,
      fromContext: currentContext,
    });

  const handleQuickSwitch = (contextName: string) =>
    switchAndClose(() => switchContextWithNamespace(contextName), { contextName, fromContext: currentContext });

  const isProd = useProductionMatcher();

  // Filter out current context since we're on a switch-specific screen
  const availableContexts = useMemo(() => contexts.filter((ctx) => !ctx.current), [contexts]);
  const { pinned, recent, toggle } = usePinnedRecent();
  const sections = useMemo(
    () => buildSections({ contexts: availableContexts, pinned, recent }),
    [availableContexts, pinned, recent]
  );
  const pinnedNames = useMemo(() => new Set(pinned), [pinned]);

  const renderItem = (context: KubernetesContext) => (
    <List.Item
      key={context.name}
      icon={contextIcon(context, isProd(context.name))}
      title={context.name}
      subtitle={{ value: contextSubtitle(context), tooltip: serverLabel(context) }}
      keywords={contextKeywords(context)}
      accessories={[
        ...prodAccessory(isProd(context.name)),
        ...providerAccessory(context),
        { text: `ns: ${context.namespace || "default"}`, tooltip: "Namespace" },
      ]}
      actions={
        <ActionPanel>
          <Action title={`Switch with Namespace Selection`} onAction={() => handleContextSelect(context.name)} />
          <Action
            title={`Quick Switch to ${context.name}`}
            onAction={() => handleQuickSwitch(context.name)}
            shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }}
          />
          <Action.Push
            title={`View ${context.name} Details`}
            icon={Icon.Info}
            target={<ContextDetails context={context} onSwitch={handleQuickSwitch} />}
          />
          <Action
            title={pinnedNames.has(context.name) ? "Unpin Context" : "Pin Context"}
            icon={pinnedNames.has(context.name) ? Icon.PinDisabled : Icon.Pin}
            shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
            onAction={() =>
              toggle(
                context.name,
                contexts.map((ctx) => ctx.name)
              )
            }
          />
          <ContextActions context={context} />
        </ActionPanel>
      }
    />
  );

  return (
    <List
      isLoading={isLoading}
      filtering
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search contexts to switch to"
    >
      {[
        { title: "Pinned", items: sections.pinned },
        { title: "Recent", items: sections.recent },
        { title: "All Contexts", items: sections.all },
      ]
        .filter((section) => section.items.length > 0)
        .map((section) => (
          <List.Section key={section.title} title={section.title}>
            {section.items.map(renderItem)}
          </List.Section>
        ))}

      {contexts.length > 0 && availableContexts.length === 0 ? (
        <List.EmptyView
          icon={Icon.CheckCircle}
          title="No Other Contexts Available"
          description={`${currentContext ?? "The current context"} is the only context in your kubeconfig`}
        />
      ) : (
        <KubeconfigEmptyView
          error={error}
          hasContexts={availableContexts.length > 0}
          searchText={searchText}
          onRefresh={refresh}
        />
      )}
    </List>
  );
}
