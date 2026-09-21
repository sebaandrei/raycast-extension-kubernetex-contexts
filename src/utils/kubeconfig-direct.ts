import { KubernetesContext, ClusterDetails } from "../types";
import { KubeconfigError, ValidationError } from "./kubeconfig-errors";
import { KubeConfig, readKubeconfigFile, writeKubeconfigFile } from "./kubeconfig-io";
import { resolveKubeconfigPath } from "./kubeconfig-path";
import { validateNamespace } from "./namespace";
import { getPreferences } from "./preferences";
import { detectCloudProvider } from "./cloud-provider";

/**
 * Get the kubeconfig file path from preferences, the first `$KUBECONFIG` entry or the default
 */
export function getKubeconfigPath(): string {
  return resolveKubeconfigPath(getPreferences().kubeconfigPath);
}

/**
 * Read and parse the kubeconfig file.
 * Throws KubeconfigError for unreadable, empty or structurally invalid files.
 */
export function readKubeconfig(kubeconfigPath: string = getKubeconfigPath()): KubeConfig {
  return readKubeconfigFile(kubeconfigPath);
}

/**
 * Write kubeconfig back to file, preserving permissions. Comments are
 * preserved only when `config` is the object returned by `readKubeconfig`
 * (not a copy or a hand-built object).
 */
export function writeKubeconfig(config: KubeConfig, kubeconfigPath: string = getKubeconfigPath()): void {
  writeKubeconfigFile(config, kubeconfigPath);
}

/**
 * Get current context from kubeconfig
 */
export function getCurrentContext(): string | null {
  const config = readKubeconfig();
  return config["current-context"] || null;
}

/**
 * Get cluster details by name
 */
export function getClusterDetails(clusterName: string, config?: KubeConfig): ClusterDetails | null {
  const kubeConfig = config || readKubeconfig();
  const cluster = kubeConfig.clusters?.find((c) => c.name === clusterName);

  if (!cluster) {
    return null;
  }

  // A malformed entry may lack its nested `cluster:` map
  const body = cluster.cluster ?? {};
  const server = body.server || "";
  const hasCA = !!(body["certificate-authority"] || body["certificate-authority-data"]);

  let hostname = "Unknown";
  let port = "Unknown";
  let protocol: ClusterDetails["protocol"] = "Unknown";

  if (server) {
    try {
      const url = new URL(server);
      hostname = url.hostname;
      port = url.port || (server.startsWith("https://") ? "443" : "80");
      protocol = server.startsWith("https://") ? "HTTPS" : server.startsWith("http://") ? "HTTP" : "Unknown";
    } catch {
      // If URL parsing fails, extract basic info
      protocol = server.startsWith("https://") ? "HTTPS" : server.startsWith("http://") ? "HTTP" : "Unknown";
      const match = server.match(/\/\/([^:/]+)/);
      hostname = match ? match[1] : "Unknown";
    }
  }

  // Secure means HTTPS with certificate verification on
  const isSecure = protocol === "HTTPS" && !body["insecure-skip-tls-verify"];

  return {
    name: clusterName,
    server,
    isSecure,
    hasCA,
    protocol,
    hostname,
    port,
  };
}

/**
 * Get user authentication method
 */
export function getUserAuthMethod(userName: string, config?: KubeConfig) {
  const kubeConfig = config || readKubeconfig();
  const user = kubeConfig.users?.find((u) => u.name === userName);

  if (!user) {
    return "Unknown";
  }

  const userConfig = user.user ?? {}; // may be missing in a malformed entry

  if (userConfig.token) return "Token";
  if (userConfig.tokenFile) return "Token File";
  if (userConfig["client-certificate"] || userConfig["client-certificate-data"]) return "Client Certificate";
  if (userConfig.username && userConfig.password) return "Basic Auth";
  if (userConfig["auth-provider"]) return `Auth Provider (${userConfig["auth-provider"].name || "Unknown"})`;
  if (userConfig.exec) return `Exec (${userConfig.exec.command || "Unknown"})`;

  return "Unknown";
}

/**
 * Get all contexts from kubeconfig
 */
export function getAllContexts(config: KubeConfig = readKubeconfig()): KubernetesContext[] {
  const currentContext = config["current-context"];

  if (!config.contexts) {
    return [];
  }

  return config.contexts.map((ctx) => {
    const { cluster = "", user = "", namespace } = ctx.context ?? {};
    const clusterDetails = getClusterDetails(cluster, config) ?? undefined;
    const exec = config.users?.find((u) => u.name === user)?.user?.exec;
    const cloudProvider = detectCloudProvider({
      execCommand: typeof exec?.command === "string" ? exec.command : undefined,
      execArgs: Array.isArray(exec?.args) ? exec.args.filter((a): a is string => typeof a === "string") : undefined,
      server: clusterDetails?.server,
    });
    return {
      name: ctx.name,
      cluster,
      user,
      namespace,
      current: ctx.name === currentContext,
      clusterDetails,
      userAuthMethod: getUserAuthMethod(user, config),
      cloudProvider,
    };
  });
}

/**
 * Read the kubeconfig, apply `mutate`, and write it back
 */
function updateConfig<T>(mutate: (config: KubeConfig) => T): T {
  const config = readKubeconfig();
  const result = mutate(config);
  writeKubeconfig(config);
  return result;
}

function requireContext(config: KubeConfig, contextName: string) {
  const context = config.contexts?.find((ctx) => ctx.name === contextName);
  if (!context) {
    throw new KubeconfigError(
      `Context "${contextName}" not found`,
      "Refresh the list; the kubeconfig may have changed"
    );
  }
  return context;
}

type ContextEntry = NonNullable<KubeConfig["contexts"]>[number];

/** Set the namespace, creating the nested `context:` map of a malformed entry only now */
function setNamespace(entry: ContextEntry, namespace: string): void {
  entry.context ??= { cluster: "", user: "" };
  entry.context.namespace = namespace;
}

/**
 * Switch to a different context
 */
export function switchToContext(contextName: string): void {
  updateConfig((config) => {
    requireContext(config, contextName);
    config["current-context"] = contextName;
  });
}

function assertValidNamespace(namespace: string): void {
  const problem = validateNamespace(namespace);
  if (problem) {
    throw new ValidationError(
      `Invalid namespace "${namespace}": ${problem}`,
      "Enter a valid Kubernetes namespace name"
    );
  }
}

/**
 * Set namespace for a context
 */
export function setContextNamespace(contextName: string, namespace: string): void {
  assertValidNamespace(namespace);
  updateConfig((config) => {
    setNamespace(requireContext(config, contextName), namespace);
  });
}

/**
 * The namespaces every cluster has: default, kube-system, kube-public, kube-node-lease.
 */
export function getCommonNamespaces(): string[] {
  return ["default", "kube-system", "kube-public", "kube-node-lease"];
}

/**
 * Get all unique namespaces from existing contexts
 */
export function getNamespacesFromContexts(config: KubeConfig = readKubeconfig()): string[] {
  const namespaces = new Set<string>();

  if (config.contexts) {
    config.contexts.forEach((ctx) => {
      const namespace = ctx.context?.namespace;
      if (namespace) {
        namespaces.add(namespace);
      }
    });
  }

  // Always include default
  namespaces.add("default");

  return Array.from(namespaces).sort();
}

/**
 * Get all available namespaces (common + from contexts)
 */
export function getAllAvailableNamespaces(config: KubeConfig = readKubeconfig()): string[] {
  const common = getCommonNamespaces();
  const fromContexts = getNamespacesFromContexts(config);

  // Combine and deduplicate
  const all = new Set([...common, ...fromContexts]);
  return Array.from(all).sort();
}

/**
 * Switch context and optionally set namespace
 */
export function switchToContextWithNamespace(contextName: string, namespace?: string): void {
  if (namespace) assertValidNamespace(namespace);
  updateConfig((config) => {
    const context = requireContext(config, contextName);
    if (namespace) {
      setNamespace(context, namespace);
    }
    config["current-context"] = contextName;
  });
}

export interface CreateContextOptions {
  /** Skip TLS verification for a newly created cluster. Off by default. */
  insecureSkipTlsVerify?: boolean;
}

function requireServerUrl(server: string | undefined): string {
  const value = server?.trim();
  if (!value) {
    throw new ValidationError(
      "Server URL is required for a new cluster",
      "Enter the API server URL, e.g. https://my-cluster.example.com:6443"
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ValidationError(
      `"${value}" is not a valid URL`,
      "Use a full URL such as https://my-cluster.example.com:6443"
    );
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ValidationError(`Unsupported protocol "${url.protocol}"`, "Use an http:// or https:// URL");
  }
  return value;
}

/**
 * Create a new context. A missing cluster is created (server URL required);
 * a missing user is created as an empty placeholder.
 */
export function createContext(
  name: string,
  clusterName: string,
  userName: string,
  namespace?: string,
  clusterServer?: string,
  options: CreateContextOptions = {}
): void {
  if (!name.trim() || !clusterName.trim() || !userName.trim()) {
    throw new ValidationError("Context, cluster and user names are required", "Fill in all required fields");
  }
  if (namespace) assertValidNamespace(namespace);

  updateConfig((config) => {
    if (config.contexts?.some((ctx) => ctx.name === name)) {
      throw new ValidationError(
        `Context "${name}" already exists`,
        "Choose a different name or modify the existing one"
      );
    }

    config.contexts ??= [];
    config.clusters ??= [];
    config.users ??= [];

    if (!config.clusters.some((c) => c.name === clusterName)) {
      config.clusters.push({
        name: clusterName,
        cluster: {
          server: requireServerUrl(clusterServer),
          ...(options.insecureSkipTlsVerify && { "insecure-skip-tls-verify": true }),
        },
      });
    }

    if (!config.users.some((u) => u.name === userName)) {
      // Placeholder without credentials; authentication must be added separately
      config.users.push({ name: userName, user: {} });
    }

    config.contexts.push({
      name,
      context: { cluster: clusterName, user: userName, ...(namespace && { namespace }) },
    });
  });
}

export interface DeleteContextResult {
  removedCluster?: string;
  removedUser?: string;
}

/**
 * Delete a context. With `removeUnused`, also remove its cluster and user
 * when no other context references them.
 */
export function deleteContext(contextName: string, options: { removeUnused?: boolean } = {}): DeleteContextResult {
  return updateConfig((config) => {
    const context = requireContext(config, contextName);

    if (config["current-context"] === contextName) {
      throw new ValidationError(
        `Cannot delete the current context "${contextName}"`,
        "Switch to another context first"
      );
    }

    const contexts = config.contexts ?? [];
    contexts.splice(contexts.indexOf(context), 1);

    const result: DeleteContextResult = {};
    if (options.removeUnused) {
      const { cluster, user } = context.context ?? {};

      if (
        cluster !== undefined &&
        !contexts.some((ctx) => ctx.context?.cluster === cluster) &&
        config.clusters?.some((c) => c.name === cluster)
      ) {
        config.clusters = config.clusters.filter((c) => c.name !== cluster);
        result.removedCluster = cluster;
      }
      if (
        user !== undefined &&
        !contexts.some((ctx) => ctx.context?.user === user) &&
        config.users?.some((u) => u.name === user)
      ) {
        config.users = config.users.filter((u) => u.name !== user);
        result.removedUser = user;
      }
    }
    return result;
  });
}

/**
 * Modify an existing context. Cluster and user must already exist.
 */
export function modifyContext(
  contextName: string,
  updates: {
    newName?: string;
    cluster?: string;
    user?: string;
    namespace?: string;
  }
): void {
  if (updates.namespace) assertValidNamespace(updates.namespace);

  updateConfig((config) => {
    const context = requireContext(config, contextName);

    const newName = updates.newName?.trim();
    if (updates.newName !== undefined && !newName) {
      throw new ValidationError("Context name cannot be empty", "Enter a name for the context");
    }
    if (newName && newName !== contextName) {
      if (config.contexts?.some((ctx) => ctx.name === newName)) {
        throw new ValidationError(`Context name "${newName}" already exists`, "Choose a different name");
      }
      if (config["current-context"] === contextName) {
        config["current-context"] = newName;
      }
      context.name = newName;
    }

    if (updates.cluster !== undefined) {
      if (!config.clusters?.some((c) => c.name === updates.cluster)) {
        throw new ValidationError(`Cluster "${updates.cluster}" does not exist`, "Choose an existing cluster");
      }
      context.context ??= { cluster: updates.cluster, user: "" };
      context.context.cluster = updates.cluster;
    }

    if (updates.user !== undefined) {
      if (!config.users?.some((u) => u.name === updates.user)) {
        throw new ValidationError(`User "${updates.user}" does not exist`, "Choose an existing user");
      }
      context.context ??= { cluster: "", user: updates.user };
      context.context.user = updates.user;
    }

    if (updates.namespace !== undefined) {
      if (updates.namespace === "") {
        if (context.context) delete context.context.namespace;
      } else {
        setNamespace(context, updates.namespace);
      }
    }
  });
}

/**
 * Get all available clusters from kubeconfig
 */
export function getAllClusters(config: KubeConfig = readKubeconfig()): Array<{ name: string; server?: string }> {
  if (!config.clusters) {
    return [];
  }

  return config.clusters.map((cluster) => ({
    name: cluster.name,
    server: cluster.cluster?.server,
  }));
}

/**
 * Get all available users from kubeconfig
 */
export function getAllUsers(config: KubeConfig = readKubeconfig()): Array<{ name: string; authMethod?: string }> {
  if (!config.users) {
    return [];
  }

  return config.users.map((user) => ({
    name: user.name,
    authMethod: getUserAuthMethod(user.name, config),
  }));
}

export interface KubeconfigState {
  readonly path: string;
  readonly contexts: KubernetesContext[];
  readonly currentContext: string | null;
  readonly namespaces: string[];
  readonly clusters: Array<{ name: string; server?: string }>;
  readonly users: Array<{ name: string; authMethod?: string }>;
}

/**
 * Read the kubeconfig once and derive everything the commands need from it.
 * The result is plain data so it can be cached.
 * Throws KubeconfigError for unreadable, empty or invalid files.
 */
export function loadKubeconfigState(path: string = getKubeconfigPath()): KubeconfigState {
  const config = readKubeconfig(path);

  return {
    path,
    contexts: getAllContexts(config),
    currentContext: config["current-context"] || null,
    namespaces: getAllAvailableNamespaces(config),
    clusters: getAllClusters(config),
    users: getAllUsers(config),
  };
}
