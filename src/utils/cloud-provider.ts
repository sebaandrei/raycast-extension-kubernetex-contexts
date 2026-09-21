export type CloudProvider = "EKS" | "AKS" | "GKE";

// Only executables that are specific to one provider; generic CLIs (az, gcloud, aws-vault)
// are used for many other purposes and would cause false badges
const EXEC_PROVIDERS: Record<string, CloudProvider> = {
  "aws-iam-authenticator": "EKS",
  kubelogin: "AKS",
  "gke-gcloud-auth-plugin": "GKE",
};

function basename(command: string): string {
  const parts = command.trim().split(/[\\/]/);
  let name = (parts[parts.length - 1] ?? "").toLowerCase();
  if (name.endsWith(".exe")) name = name.slice(0, -4);
  return name;
}

function hostOf(server: string): string {
  try {
    return new URL(server).hostname.toLowerCase();
  } catch {
    const match = server.match(/\/\/([^:/]+)/);
    return (match ? match[1] : server).toLowerCase();
  }
}

function providerFromHost(host: string): CloudProvider | undefined {
  if (host.endsWith(".eks.amazonaws.com") || host.endsWith(".eks.amazonaws.com.cn")) return "EKS";
  if (host.endsWith(".azmk8s.io") || host.endsWith(".azmk8s.us") || host.endsWith(".azmk8s.cn")) return "AKS";
  if (host === "container.googleapis.com") return "GKE";
  return undefined;
}

/** Guess the managed Kubernetes provider from the auth exec command, else from the server host. */
export function detectCloudProvider(input: {
  execCommand?: string;
  execArgs?: string[];
  server?: string;
}): CloudProvider | undefined {
  if (input.execCommand) {
    const name = basename(input.execCommand);
    const provider = EXEC_PROVIDERS[name];
    if (provider) return provider;
    // `aws` is generic; `aws eks get-token` is the EKS auth flow
    if (name === "aws" && input.execArgs?.includes("eks")) return "EKS";
  }
  return input.server ? providerFromHost(hostOf(input.server)) : undefined;
}
