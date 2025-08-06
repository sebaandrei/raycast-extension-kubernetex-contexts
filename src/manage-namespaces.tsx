import { List, ActionPanel, Action, Form, useNavigation, Icon } from "@raycast/api";
import { useKubeconfig } from "./hooks/useKubeconfig";
import { showSuccessToast, showErrorToast } from "./utils/errors";
import { useState } from "react";

interface SetNamespaceFormProps {
  contextName: string;
  currentNamespace?: string;
  availableNamespaces: string[];
  onSubmit: (namespace: string) => void;
  onCancel: () => void;
}

function SetNamespaceForm({ contextName, currentNamespace, availableNamespaces, onSubmit, onCancel }: SetNamespaceFormProps) {
  const [selectedNamespace, setSelectedNamespace] = useState(currentNamespace || "default");

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={`Set Namespace for ${contextName}`}
            onSubmit={() => onSubmit(selectedNamespace)}
          />
          <Action
            title="Cancel"
            onAction={onCancel}
            shortcut={{ modifiers: ["cmd"], key: "w" }}
          />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        id="namespace"
        title="Namespace"
        placeholder="Select or enter namespace"
        value={selectedNamespace}
        onChange={setSelectedNamespace}
      >
        {availableNamespaces.map((namespace) => (
          <Form.Dropdown.Item
            key={namespace}
            value={namespace}
            title={namespace}
            icon={namespace === currentNamespace ? Icon.Checkmark : undefined}
          />
        ))}
      </Form.Dropdown>
      <Form.TextField
        id="customNamespace"
        title="Custom Namespace"
        placeholder="Or enter a custom namespace name"
        onChange={(value) => {
          if (value.trim()) {
            setSelectedNamespace(value.trim());
          }
        }}
      />
      <Form.Description text={`Current namespace for ${contextName}: ${currentNamespace || "default"}`} />
    </Form>
  );
}

export default function ManageNamespaces() {
  const { contexts, namespaces, isLoading, error, setNamespace } = useKubeconfig();
  const { push, pop } = useNavigation();

  const handleSetNamespace = (contextName: string, currentNamespace?: string) => {
    push(
      <SetNamespaceForm
        contextName={contextName}
        currentNamespace={currentNamespace}
        availableNamespaces={namespaces}
        onSubmit={(namespace) => submitNamespaceChange(contextName, namespace)}
        onCancel={() => pop()}
      />
    );
  };

  const submitNamespaceChange = async (contextName: string, namespace: string) => {
    try {
      const success = await setNamespace(contextName, namespace);
      if (success) {
        await showSuccessToast("Namespace Updated", `Set namespace for ${contextName} to: ${namespace}`);
        pop();
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

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search contexts to manage namespaces...">
      <List.Section title="Available Contexts">
        {contexts.map((context) => (
          <List.Item
            key={context.name}
            icon={context.current ? Icon.CheckCircle : Icon.Circle}
            title={context.name}
            subtitle={`Cluster: ${context.cluster}`}
            accessories={[
              { text: `ns: ${context.namespace || "default"}`, tooltip: "Current namespace" },
              { text: context.current ? "current" : "", tooltip: context.current ? "Active context" : undefined }
            ]}
            actions={
              <ActionPanel>
                <Action
                  title="Set Namespace"
                  icon={Icon.Pencil}
                  onAction={() => handleSetNamespace(context.name, context.namespace)}
                />
                {context.namespace && (
                  <Action
                    title="Clear Namespace (use default)"
                    icon={Icon.Trash}
                    onAction={() => submitNamespaceChange(context.name, "")}
                    shortcut={{ modifiers: ["cmd"], key: "d" }}
                  />
                )}
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
      
      {contexts.length === 0 && !isLoading && (
        <List.Item
          title="No Contexts Found"
          subtitle="Check your ~/.kube/config file"
          accessories={[{ text: "⚠️" }]}
        />
      )}
      
      <List.Section title="Available Namespaces">
        {namespaces.map((namespace) => (
          <List.Item
            key={`ns-${namespace}`}
            icon={Icon.Folder}
            title={namespace}
            subtitle="Available namespace"
            accessories={[
              { text: `${contexts.filter(ctx => ctx.namespace === namespace).length} contexts`, tooltip: "Number of contexts using this namespace" }
            ]}
          />
        ))}
      </List.Section>
    </List>
  );
}