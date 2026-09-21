import { readFileSync } from "fs";
import { KubernetesContext, ClusterDetails } from "../types";
import { KubeconfigError, ValidationError } from "./kubeconfig-errors";
import { KubeConfig, readKubeconfigFile, writeKubeconfigFile } from "./kubeconfig-io";
import { resolveKubeconfigPath } from "./kubeconfig-path";
import { validateNamespace } from "./namespace";
import { getPreferences } from "./preferences";

/**
 * Get the kubeconfig file path from preferences, environment or default
 */
export function getKubeconfigPath(): string {
  return resolveKubeconfigPath(getPreferences().kubeconfigPath);
}

/**
 * Read and parse the kubeconfig file
 */
export function readKubeconfig(kubeconfigPath: string = getKubeconfigPath()): KubeConfig {
  return readKubeconfigFile(kubeconfigPath);
}

/**
 * Write kubeconfig back to file, preserving comments and permissions
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

  const server = cluster.cluster.server || "";
  const isSecure = !cluster.cluster["insecure-skip-tls-verify"];
  const hasCA = !!(cluster.cluster["certificate-authority"] || cluster.cluster["certificate-authority-data"]);

  let hostname = "Unknown";
  let port = "Unknown";
  let protocol = "Unknown";

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

  const userConfig = user.user;

  if (userConfig.token) return "Token";
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

  return config.contexts.map((ctx) => ({
    name: ctx.name,
    cluster: ctx.context.cluster,
    user: ctx.context.user,
    namespace: ctx.context.namespace,
    current: ctx.name === currentContext,
    clusterDetails: getClusterDetails(ctx.context.cluster, config) ?? undefined,
    userAuthMethod: getUserAuthMethod(ctx.context.user, config),
  }));
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
    requireContext(config, contextName).context.namespace = namespace;
  });
}

/**
 * Get available namespaces (common ones + context-specific ones)
 */
export function getCommonNamespaces(): string[] {
  // Common Kubernetes namespaces
  return ["default", "kube-system", "kube-public", "kube-node-lease"];
}

/**
 * Get all unique namespaces from existing contexts
 */
export function getNamespacesFromContexts(config: KubeConfig = readKubeconfig()): string[] {
  const namespaces = new Set<string>();

  if (config.contexts) {
    config.contexts.forEach((ctx) => {
      if (ctx.context.namespace) {
        namespaces.add(ctx.context.namespace);
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
      context.context.namespace = namespace;
    }
    config["current-context"] = contextName;
  });
}

/**
 * Check if kubeconfig file exists and is readable
 */
export function isKubeconfigAvailable(): boolean {
  try {
    const kubeconfigPath = getKubeconfigPath();
    readFileSync(kubeconfigPath, "utf8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Get kubeconfig file information
 */
export function getKubeconfigInfo() {
  const kubeconfigPath = getKubeconfigPath();
  const available = isKubeconfigAvailable();

  let contextCount = 0;
  let currentContext = null;

  if (available) {
    const contexts = getAllContexts();
    contextCount = contexts.length;
    currentContext = getCurrentContext();
  }

  return {
    path: kubeconfigPath,
    available,
    contextCount,
    currentContext,
  };
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

    config.contexts!.splice(config.contexts!.indexOf(context), 1);

    const result: DeleteContextResult = {};
    if (options.removeUnused) {
      const { cluster, user } = context.context;

      if (
        !config.contexts!.some((ctx) => ctx.context.cluster === cluster) &&
        config.clusters?.some((c) => c.name === cluster)
      ) {
        config.clusters = config.clusters.filter((c) => c.name !== cluster);
        result.removedCluster = cluster;
      }
      if (!config.contexts!.some((ctx) => ctx.context.user === user) && config.users?.some((u) => u.name === user)) {
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
      context.context.cluster = updates.cluster;
    }

    if (updates.user !== undefined) {
      if (!config.users?.some((u) => u.name === updates.user)) {
        throw new ValidationError(`User "${updates.user}" does not exist`, "Choose an existing user");
      }
      context.context.user = updates.user;
    }

    if (updates.namespace !== undefined) {
      if (updates.namespace === "") {
        delete context.context.namespace;
      } else {
        context.context.namespace = updates.namespace;
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
    server: cluster.cluster.server,
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
  path: string;
  contexts: KubernetesContext[];
  currentContext: string | null;
  namespaces: string[];
  clusters: Array<{ name: string; server?: string }>;
  users: Array<{ name: string; authMethod?: string }>;
}

/**
 * Read the kubeconfig once and derive everything the commands need from it.
 * The result is plain data so it can be cached. Throws the typed error if the file is unreadable.
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
