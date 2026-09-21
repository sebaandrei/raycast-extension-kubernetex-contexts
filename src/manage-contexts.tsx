import { Alert, List, ActionPanel, Action, Icon, Form, useNavigation, Keyboard, confirmAlert } from "@raycast/api";
import { useMemo, useState } from "react";
import { useKubeconfig } from "./hooks/useKubeconfig";
import { createContext, deleteContext, modifyContext } from "./utils/kubeconfig-direct";
import { KubernetesContext } from "./types";
import { showSuccessToast, showErrorToast } from "./utils/errors";
import { switchAndClose } from "./utils/switch";
import { validateNamespace } from "./utils/namespace";
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

export default function ManageContexts() {
  const { contexts, clusters, users, isLoading, error, refresh, switchContext, currentContext } = useKubeconfig();
  const [searchText, setSearchText] = useState("");
  const sortedContexts = useMemo(() => currentFirst(contexts), [contexts]);

  const isProd = useProductionMatcher();

  async function handleDelete(contextName: string, removeUnused: boolean) {
    const prod = isProd(contextName);
    const message = [
      prod ? `"${contextName}" is a production context. Deleting it cannot be undone.` : `Delete "${contextName}"?`,
      removeUnused
        ? "Its cluster and user are also removed when no other context uses them."
        : "Its cluster and user entries are kept.",
    ].join(" ");
    const confirmed = await confirmAlert({
      title: prod ? "Delete production context?" : "Delete context?",
      message,
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;

    try {
      const { removedCluster, removedUser } = deleteContext(contextName, { removeUnused });
      const removed = [removedCluster && `cluster ${removedCluster}`, removedUser && `user ${removedUser}`].filter(
        Boolean
      );
      await showSuccessToast(
        "Context Deleted",
        `Deleted ${contextName}${removed.length > 0 ? ` and unused ${removed.join(", ")}` : ""}`
      );
      refresh();
    } catch (err) {
      await showErrorToast(err as Error);
    }
  }

  return (
    <List
      isLoading={isLoading}
      filtering
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search contexts to manage"
      actions={
        <ActionPanel>
          <Action.Push
            title="Create New Context"
            icon={Icon.Plus}
            target={<CreateContextForm clusters={clusters} users={users} onCreated={refresh} />}
          />
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            onAction={refresh}
            shortcut={Keyboard.Shortcut.Common.Refresh}
          />
        </ActionPanel>
      }
    >
      {sortedContexts.map((context) => (
        <List.Item
          key={context.name}
          icon={contextIcon(context, isProd(context.name))}
          title={context.name}
          subtitle={{ value: contextSubtitle(context), tooltip: serverLabel(context) }}
          keywords={contextKeywords(context)}
          accessories={[
            ...prodAccessory(isProd(context.name)),
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
              <Action.Push
                title="Create New Context"
                icon={Icon.Plus}
                target={<CreateContextForm clusters={clusters} users={users} onCreated={refresh} />}
              />
              <Action.Push
                title={`Modify ${context.name}`}
                icon={Icon.Pencil}
                shortcut={Keyboard.Shortcut.Common.Edit}
                target={<ModifyContextForm context={context} clusters={clusters} users={users} onModified={refresh} />}
              />
              {!context.current && (
                <>
                  <Action
                    title={`Delete ${context.name}`}
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    shortcut={Keyboard.Shortcut.Common.Remove}
                    onAction={() => handleDelete(context.name, false)}
                  />
                  <Action
                    title={`Delete ${context.name} and Unused Cluster/User`}
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    shortcut={Keyboard.Shortcut.Common.RemoveAll}
                    onAction={() => handleDelete(context.name, true)}
                  />
                </>
              )}
              <Action.Push
                title={`View ${context.name} Details`}
                icon={Icon.Info}
                target={
                  <ContextDetails
                    context={context}
                    onSwitch={(name) =>
                      switchAndClose(() => switchContext(name), { contextName: name, fromContext: currentContext })
                    }
                  />
                }
              />
              <Action
                title="Refresh"
                icon={Icon.ArrowClockwise}
                onAction={refresh}
                shortcut={Keyboard.Shortcut.Common.Refresh}
              />
            </ActionPanel>
          }
        />
      ))}

      <KubeconfigEmptyView error={error} hasContexts={contexts.length > 0} searchText={searchText} onRefresh={refresh}>
        <Action.Push
          title="Create New Context"
          icon={Icon.Plus}
          target={<CreateContextForm clusters={clusters} users={users} onCreated={refresh} />}
        />
      </KubeconfigEmptyView>
    </List>
  );
}

interface ClusterOption {
  name: string;
  server?: string;
}

interface UserOption {
  name: string;
  authMethod?: string;
}

function CreateContextForm({
  clusters,
  users,
  onCreated,
}: {
  clusters: ClusterOption[];
  users: UserOption[];
  onCreated: () => void;
}) {
  const { pop } = useNavigation();
  const [nameError, setNameError] = useState<string | undefined>();
  const [clusterError, setClusterError] = useState<string | undefined>();
  const [userError, setUserError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | undefined>();
  const [namespaceError, setNamespaceError] = useState<string | undefined>();
  const [useExistingCluster, setUseExistingCluster] = useState(true);
  const [useExistingUser, setUseExistingUser] = useState(true);

  async function handleSubmit(values: {
    name: string;
    cluster?: string;
    clusterName?: string;
    clusterServer?: string;
    insecureSkipTlsVerify?: boolean;
    user?: string;
    userName?: string;
    namespace?: string;
  }) {
    // Validation
    if (!values.name.trim()) {
      setNameError("Context name is required");
      return;
    }

    const clusterName = useExistingCluster ? values.cluster?.trim() : values.clusterName?.trim();
    if (!clusterName) {
      setClusterError("Cluster name is required");
      return;
    }

    const userName = useExistingUser ? values.user?.trim() : values.userName?.trim();
    if (!userName) {
      setUserError("User name is required");
      return;
    }

    if (!useExistingCluster && !values.clusterServer?.trim()) {
      setServerError("Server URL is required for a new cluster");
      return;
    }

    const namespaceProblem = values.namespace?.trim() ? validateNamespace(values.namespace.trim()) : undefined;
    if (namespaceProblem) {
      setNamespaceError(namespaceProblem);
      return;
    }

    try {
      createContext(
        values.name.trim(),
        clusterName,
        userName,
        values.namespace?.trim() || undefined,
        useExistingCluster ? undefined : values.clusterServer?.trim(),
        { insecureSkipTlsVerify: !useExistingCluster && values.insecureSkipTlsVerify === true }
      );

      await showSuccessToast("Context Created", `Successfully created context: ${values.name}`);
      onCreated();
      pop();
    } catch (error) {
      await showErrorToast(error as Error);
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Context" onSubmit={handleSubmit} />
          <Action title="Cancel" onAction={() => pop()} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Context Name"
        placeholder="my-new-context"
        error={nameError}
        onChange={() => setNameError(undefined)}
      />

      <Form.Checkbox
        id="useExistingCluster"
        title="Cluster Selection"
        label="Use existing cluster"
        value={useExistingCluster}
        onChange={setUseExistingCluster}
      />

      {useExistingCluster ? (
        <Form.Dropdown id="cluster" title="Cluster" error={clusterError} onChange={() => setClusterError(undefined)}>
          <Form.Dropdown.Item value="" title="Select a cluster..." />
          {clusters.map((cluster) => (
            <Form.Dropdown.Item
              key={cluster.name}
              value={cluster.name}
              title={`${cluster.name}${cluster.server ? ` (${cluster.server})` : ""}`}
            />
          ))}
        </Form.Dropdown>
      ) : (
        <>
          <Form.TextField
            id="clusterName"
            title="Cluster Name"
            placeholder="my-cluster"
            error={clusterError}
            onChange={() => setClusterError(undefined)}
          />
          <Form.TextField
            id="clusterServer"
            title="Cluster Server URL"
            placeholder="https://my-cluster.example.com:6443"
            error={serverError}
            onChange={() => setServerError(undefined)}
          />
          <Form.Checkbox
            id="insecureSkipTlsVerify"
            title="TLS"
            label="Skip TLS verification (insecure)"
            info="Only enable for clusters with self-signed certificates you trust. Traffic is not verified."
            defaultValue={false}
          />
        </>
      )}

      <Form.Checkbox
        id="useExistingUser"
        title="User Selection"
        label="Use existing user"
        value={useExistingUser}
        onChange={setUseExistingUser}
      />

      {useExistingUser ? (
        <Form.Dropdown id="user" title="User" error={userError} onChange={() => setUserError(undefined)}>
          <Form.Dropdown.Item value="" title="Select a user..." />
          {users.map((user) => (
            <Form.Dropdown.Item
              key={user.name}
              value={user.name}
              title={`${user.name}${user.authMethod ? ` (${user.authMethod})` : ""}`}
            />
          ))}
        </Form.Dropdown>
      ) : (
        <Form.TextField
          id="userName"
          title="User Name"
          placeholder="my-user"
          error={userError}
          onChange={() => setUserError(undefined)}
        />
      )}

      <Form.TextField
        id="namespace"
        title="Namespace (Optional)"
        placeholder="default"
        error={namespaceError}
        onChange={() => setNamespaceError(undefined)}
      />
    </Form>
  );
}

function ModifyContextForm({
  context,
  clusters,
  users,
  onModified,
}: {
  context: KubernetesContext;
  clusters: ClusterOption[];
  users: UserOption[];
  onModified: () => void;
}) {
  const { pop } = useNavigation();
  const [nameError, setNameError] = useState<string | undefined>();
  const [namespaceError, setNamespaceError] = useState<string | undefined>();

  async function handleSubmit(values: { name: string; cluster?: string; user?: string; namespace?: string }) {
    // Validation
    if (!values.name.trim()) {
      setNameError("Context name is required");
      return;
    }

    const namespaceProblem = values.namespace?.trim() ? validateNamespace(values.namespace.trim()) : undefined;
    if (namespaceProblem) {
      setNamespaceError(namespaceProblem);
      return;
    }

    try {
      const updates: {
        newName?: string;
        cluster?: string;
        user?: string;
        namespace?: string;
      } = {};

      if (values.name.trim() !== context.name) {
        updates.newName = values.name.trim();
      }

      const newCluster = values.cluster?.trim();
      if (newCluster && newCluster !== context.cluster) {
        updates.cluster = newCluster;
      }

      const newUser = values.user?.trim();
      if (newUser && newUser !== context.user) {
        updates.user = newUser;
      }

      const newNamespace = values.namespace?.trim() || "";
      const currentNamespace = context.namespace || "";
      if (newNamespace !== currentNamespace) {
        updates.namespace = newNamespace;
      }

      if (Object.keys(updates).length === 0) {
        await showSuccessToast("No Changes", "No modifications were made");
        pop();
        return;
      }

      modifyContext(context.name, updates);

      await showSuccessToast("Context Modified", `Successfully updated context: ${values.name}`);
      onModified();
      pop();
    } catch (error) {
      await showErrorToast(error as Error);
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Update Context" onSubmit={handleSubmit} />
          <Action title="Cancel" onAction={() => pop()} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Context Name"
        defaultValue={context.name}
        error={nameError}
        onChange={() => setNameError(undefined)}
      />

      <Form.Dropdown id="cluster" title="Cluster" defaultValue={context.cluster}>
        {clusters.map((cluster) => (
          <Form.Dropdown.Item
            key={cluster.name}
            value={cluster.name}
            title={`${cluster.name}${cluster.server ? ` (${cluster.server})` : ""}`}
          />
        ))}
      </Form.Dropdown>

      <Form.Dropdown id="user" title="User" defaultValue={context.user}>
        {users.map((user) => (
          <Form.Dropdown.Item
            key={user.name}
            value={user.name}
            title={`${user.name}${user.authMethod ? ` (${user.authMethod})` : ""}`}
          />
        ))}
      </Form.Dropdown>

      <Form.TextField
        id="namespace"
        title="Namespace"
        defaultValue={context.namespace || ""}
        placeholder="default"
        error={namespaceError}
        onChange={() => setNamespaceError(undefined)}
      />
    </Form>
  );
}
