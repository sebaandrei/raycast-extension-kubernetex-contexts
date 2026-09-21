import { validateNamespace } from "./namespace";

export interface ContextUpdates {
  newName?: string;
  cluster?: string;
  user?: string;
  namespace?: string;
}

/** Only the fields that changed, trimmed. Clearing the namespace yields "" (not undefined). */
export function computeContextUpdates(
  original: { name: string; cluster: string; user: string; namespace?: string },
  values: { name: string; cluster?: string; user?: string; namespace?: string }
): ContextUpdates {
  const updates: ContextUpdates = {};

  const name = values.name.trim();
  if (name !== original.name) updates.newName = name;

  const cluster = values.cluster?.trim();
  if (cluster && cluster !== original.cluster) updates.cluster = cluster;

  const user = values.user?.trim();
  if (user && user !== original.user) updates.user = user;

  const namespace = values.namespace?.trim() || "";
  if (namespace !== (original.namespace || "")) updates.namespace = namespace;

  return updates;
}

export interface CreateContextFormValues {
  name: string;
  cluster?: string;
  clusterName?: string;
  clusterServer?: string;
  user?: string;
  userName?: string;
  namespace?: string;
}

export type CreateContextFormErrors = Partial<Record<"name" | "cluster" | "user" | "server" | "namespace", string>>;

/** Validate the create form; returns the first field error found, or null when valid. */
export function validateCreateContextForm(
  values: CreateContextFormValues,
  options: { useExistingCluster: boolean; useExistingUser: boolean }
): CreateContextFormErrors | null {
  if (!values.name.trim()) return { name: "Context name is required" };

  const clusterName = options.useExistingCluster ? values.cluster?.trim() : values.clusterName?.trim();
  if (!clusterName) return { cluster: "Cluster name is required" };

  const userName = options.useExistingUser ? values.user?.trim() : values.userName?.trim();
  if (!userName) return { user: "User name is required" };

  if (!options.useExistingCluster && !values.clusterServer?.trim()) {
    return { server: "Server URL is required for a new cluster" };
  }

  const namespace = values.namespace?.trim();
  const namespaceProblem = namespace ? validateNamespace(namespace) : undefined;
  if (namespaceProblem) return { namespace: namespaceProblem };

  return null;
}

/** Text for the toast shown after deleting a context. */
export function describeRemoval(
  contextName: string,
  result: { removedCluster?: string; removedUser?: string }
): string {
  const removed = [
    result.removedCluster && `cluster ${result.removedCluster}`,
    result.removedUser && `user ${result.removedUser}`,
  ].filter(Boolean);
  return `Deleted ${contextName}${removed.length > 0 ? ` and unused ${removed.join(", ")}` : ""}`;
}
