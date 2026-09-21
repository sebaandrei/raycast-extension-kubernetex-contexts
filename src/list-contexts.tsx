import { List, ActionPanel, Action, Icon, showToast, Toast } from "@raycast/api";
import { useMemo } from "react";
import { useKubeconfig } from "./hooks/useKubeconfig";
import { switchAndClose } from "./utils/switch";
import { ContextDetails } from "./components/ContextDetails";
import { KubeconfigEmptyView } from "./components/KubeconfigEmptyView";
import {
  contextIcon,
  contextKeywords,
  contextSubtitle,
  currentFirst,
  prodAccessory,
  serverLabel,
} from "./components/context-visuals";
import { useProductionMatcher } from "./hooks/useProductionMatcher";

export default function ListContexts() {
  const { contexts, currentContext, isLoading, error, refresh, switchContext } = useKubeconfig();
  const handleSwitchContext = async (contextName: string) => {
    await switchAndClose(() => switchContext(contextName), { contextName, fromContext: currentContext });
  };

  const isProd = useProductionMatcher();

  const sortedContexts = useMemo(() => currentFirst(contexts), [contexts]);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search contexts by name, cluster, user, or namespace">
      {sortedContexts.map((context) => (
        <List.Item
          key={context.name}
          icon={contextIcon(context, isProd(context.name))}
          title={context.name}
          subtitle={{ value: contextSubtitle(context), tooltip: serverLabel(context) }}
          keywords={contextKeywords(context)}
          accessories={[
            ...prodAccessory(isProd(context.name)),
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
      <KubeconfigEmptyView error={error} onRefresh={refresh} />
    </List>
  );
}
