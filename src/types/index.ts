import type { CloudProvider } from "../utils/cloud-provider";

// Kubernetes cluster metadata
export interface ClusterDetails {
  name: string;
  server: string;
  isSecure: boolean;
  hasCA: boolean;
  protocol: "HTTPS" | "HTTP" | "Unknown";
  hostname: string;
  port: string;
}

// Kubernetes context interface
export interface KubernetesContext {
  name: string;
  cluster: string;
  user: string;
  namespace?: string;
  current?: boolean;
  clusterDetails?: ClusterDetails;
  userAuthMethod?: string;
  cloudProvider?: CloudProvider;
}
