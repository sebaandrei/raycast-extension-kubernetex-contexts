import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { parse, stringify } from "yaml";
import { KubernetesContext } from "../types";

// Default kubeconfig location
const DEFAULT_KUBECONFIG = join(homedir(), ".kube", "config");

interface KubeConfig {
  "current-context"?: string;
  contexts?: Array<{
    name: string;
    context: {
      cluster: string;
      user: string;
      namespace?: string;
    };
  }>;
  clusters?: Array<{
    name: string;
    cluster: any;
  }>;
  users?: Array<{
    name: string;
    user: any;
  }>;
}

/**
 * Get the kubeconfig file path from environment or default
 */
function getKubeconfigPath(): string {
  return process.env.KUBECONFIG || DEFAULT_KUBECONFIG;
}

/**
 * Read and parse the kubeconfig file
 */
export function readKubeconfig(): KubeConfig {
  try {
    const kubeconfigPath = getKubeconfigPath();
    
    if (!existsSync(kubeconfigPath)) {
      console.warn("Kubeconfig file not found:", kubeconfigPath);
      return {};
    }
    
    const content = readFileSync(kubeconfigPath, "utf8");
    return parse(content) || {};
  } catch (error) {
    console.error("Failed to read kubeconfig:", error);
    return {};
  }
}

/**
 * Write kubeconfig back to file
 */
export function writeKubeconfig(config: KubeConfig): void {
  try {
    const kubeconfigPath = getKubeconfigPath();
    const content = stringify(config);
    writeFileSync(kubeconfigPath, content, "utf8");
  } catch (error) {
    console.error("Failed to write kubeconfig:", error);
    throw error;
  }
}

/**
 * Get current context from kubeconfig
 */
export function getCurrentContext(): string | null {
  const config = readKubeconfig();
  return config["current-context"] || null;
}

/**
 * Get all contexts from kubeconfig
 */
export function getAllContexts(): KubernetesContext[] {
  const config = readKubeconfig();
  const currentContext = config["current-context"];
  
  if (!config.contexts) {
    return [];
  }

  return config.contexts.map(ctx => ({
    name: ctx.name,
    cluster: ctx.context.cluster,
    user: ctx.context.user,
    namespace: ctx.context.namespace,
    current: ctx.name === currentContext,
  }));
}

/**
 * Switch to a different context
 */
export function switchToContext(contextName: string): boolean {
  try {
    const config = readKubeconfig();
    
    // Verify the context exists
    const contextExists = config.contexts?.some(ctx => ctx.name === contextName);
    if (!contextExists) {
      throw new Error(`Context "${contextName}" not found`);
    }
    
    // Update current context
    config["current-context"] = contextName;
    
    // Write back to file
    writeKubeconfig(config);
    
    return true;
  } catch (error) {
    console.error("Failed to switch context:", error);
    return false;
  }
}

/**
 * Set namespace for a context
 */
export function setContextNamespace(contextName: string, namespace: string): boolean {
  try {
    const config = readKubeconfig();
    
    if (!config.contexts) {
      throw new Error("No contexts found in kubeconfig");
    }
    
    const contextIndex = config.contexts.findIndex(ctx => ctx.name === contextName);
    if (contextIndex === -1) {
      throw new Error(`Context "${contextName}" not found`);
    }
    
    // Update namespace
    config.contexts[contextIndex].context.namespace = namespace;
    
    // Write back to file
    writeKubeconfig(config);
    
    return true;
  } catch (error) {
    console.error("Failed to set context namespace:", error);
    return false;
  }
}

/**
 * Get available namespaces (common ones + context-specific ones)
 */
export function getCommonNamespaces(): string[] {
  // Common Kubernetes namespaces
  return [
    "default",
    "kube-system", 
    "kube-public",
    "kube-node-lease",
  ];
}

/**
 * Get all unique namespaces from existing contexts
 */
export function getNamespacesFromContexts(): string[] {
  const config = readKubeconfig();
  const namespaces = new Set<string>();
  
  if (config.contexts) {
    config.contexts.forEach(ctx => {
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
export function getAllAvailableNamespaces(): string[] {
  const common = getCommonNamespaces();
  const fromContexts = getNamespacesFromContexts();
  
  // Combine and deduplicate
  const all = new Set([...common, ...fromContexts]);
  return Array.from(all).sort();
}

/**
 * Switch context and optionally set namespace
 */
export function switchToContextWithNamespace(contextName: string, namespace?: string): boolean {
  try {
    const config = readKubeconfig();
    
    // Verify the context exists
    const contextExists = config.contexts?.some(ctx => ctx.name === contextName);
    if (!contextExists) {
      throw new Error(`Context "${contextName}" not found`);
    }
    
    // If namespace is provided, set it for the context first
    if (namespace) {
      const contextIndex = config.contexts!.findIndex(ctx => ctx.name === contextName);
      if (contextIndex !== -1) {
        config.contexts![contextIndex].context.namespace = namespace;
      }
    }
    
    // Update current context
    config["current-context"] = contextName;
    
    // Write back to file
    writeKubeconfig(config);
    
    return true;
  } catch (error) {
    console.error("Failed to switch context with namespace:", error);
    return false;
  }
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