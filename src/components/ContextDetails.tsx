import { Detail, ActionPanel, Action, Icon, useNavigation } from "@raycast/api";
import { KubernetesContext } from "../types";
import { escapeMarkdown } from "../utils/markdown";

interface ContextDetailsProps {
  context: KubernetesContext;
  /** Ready-made handler (already gives feedback and closes Raycast). */
  onSwitch: (contextName: string) => Promise<unknown>;
}

export function ContextDetails({ context, onSwitch }: ContextDetailsProps) {
  const { pop } = useNavigation();

  const generateMarkdown = () => {
    const name = escapeMarkdown(context.name);
    const details = context.clusterDetails;
    return `
# ${name}

${context.current ? "**Current active context**" : "Not the current context"}

### Basic Information
- **Name**: ${name}
- **Cluster**: ${escapeMarkdown(context.cluster)}
- **User**: ${escapeMarkdown(context.user)}
- **Namespace**: ${escapeMarkdown(context.namespace || "default")}
- **Authentication**: ${escapeMarkdown(context.userAuthMethod || "Unknown")}

${
  details
    ? `
### Cluster Details
- **Server**: ${escapeMarkdown(details.server || "Not specified")}
- **Hostname**: ${escapeMarkdown(details.hostname)}
- **Port**: ${escapeMarkdown(details.port)}
- **Protocol**: ${escapeMarkdown(details.protocol)}
- **Security**: ${details.isSecure ? "Secure (TLS enabled)" : "Insecure (TLS disabled)"}
- **CA Certificate**: ${details.hasCA ? "Present" : "Missing"}
`
    : `
### Cluster Details
*Cluster information not available. The cluster may not be configured.*
`
}

### Usage
${
  context.current
    ? `All kubectl commands run against this context. Use the "Kube Contexts" command to switch to another one.`
    : `Use the "Switch to ${name}" action below, or the "Kube Contexts" command, to make this the active context.`
}
    `;
  };

  return (
    <Detail
      markdown={generateMarkdown()}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Context Name" text={context.name} />
          <Detail.Metadata.Label
            title="Status"
            text={context.current ? "Active" : "Inactive"}
            icon={context.current ? Icon.CheckCircle : Icon.Circle}
          />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="Cluster" text={context.cluster} />
          <Detail.Metadata.Label title="User" text={context.user} />
          <Detail.Metadata.Label title="Namespace" text={context.namespace || "default"} />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="Authentication" text={context.userAuthMethod || "Unknown"} />
          {context.clusterDetails && (
            <>
              <Detail.Metadata.Separator />
              <Detail.Metadata.Label title="Server" text={context.clusterDetails.server || "Not configured"} />
              <Detail.Metadata.Label title="Hostname" text={context.clusterDetails.hostname} />
              <Detail.Metadata.Label title="Port" text={context.clusterDetails.port} />
              <Detail.Metadata.Label title="Protocol" text={context.clusterDetails.protocol} />
              <Detail.Metadata.Label
                title="Security"
                text={context.clusterDetails.isSecure ? "Secure" : "Insecure"}
                icon={context.clusterDetails.isSecure ? Icon.Lock : Icon.ExclamationMark}
              />
              <Detail.Metadata.Label
                title="CA Certificate"
                text={context.clusterDetails.hasCA ? "Present" : "Missing"}
                icon={context.clusterDetails.hasCA ? Icon.CheckCircle : Icon.XMarkCircle}
              />
            </>
          )}
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action title="Back to Contexts List" icon={Icon.ArrowLeft} onAction={() => pop()} />
          {!context.current && (
            <Action
              title={`Switch to ${context.name}`}
              icon={Icon.ArrowRight}
              onAction={() => onSwitch(context.name)}
            />
          )}
        </ActionPanel>
      }
    />
  );
}
