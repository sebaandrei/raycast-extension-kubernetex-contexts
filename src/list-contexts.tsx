import { List, ActionPanel, Action, Icon, showToast, Toast } from "@raycast/api";
import { useMemo, useState } from "react";
import { useKubeconfig } from "./hooks/useKubeconfig";
import { switchAndClose } from "./utils/switch";
import { ContextDetails } from "./components/ContextDetails";
import { KubeconfigEmptyView } from "./components/KubeconfigEmptyView";
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

export default function ListContexts() {
  const { contexts, currentContext, isLoading, error, refresh, switchContext } = useKubeconfig();
  const handleSwitchContext = async (contextName: string) => {
    await switchAndClose(() => switchContext(contextName), { contextName, fromContext: currentContext });
  };

  const isProd = useProductionMatcher();

  const [searchText, setSearchText] = useState("");
  const { pinned, recent, toggle } = usePinnedRecent();
  const sections = useMemo(() => buildSections({ contexts, pinned, recent }), [contexts, pinned, recent]);
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
        { text: context.userAuthMethod || "Unknown", tooltip: "Authentication Method" },
        ...(context.clusterDetails
          ? [
              {
                text: context.clusterDetails.protocol,
                tooltip: `${context.clusterDetails.isSecure ? "Secure" : "Insecure"} connection`,
              },
            ]
          : []),
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
      searchBarPlaceholder="Search contexts by name, cluster, user, or namespace"
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
      <KubeconfigEmptyView
        error={error}
        hasContexts={contexts.length > 0}
        searchText={searchText}
        onRefresh={refresh}
      />
    </List>
  );
}
