import { homedir } from "os";
import { delimiter, join } from "path";

/**
 * Expand a leading `~` to the home directory
 */
export function expandHome(path: string, home: string = homedir()): string {
  if (path === "~") return home;
  if (path.startsWith("~/")) return join(home, path.slice(2));
  return path;
}

/**
 * Resolve the kubeconfig path.
 * Order: explicit preference, first entry of $KUBECONFIG, ~/.kube/config
 */
export function resolveKubeconfigPath(
  preferred?: string,
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir()
): string {
  const fromPreference = preferred?.trim();
  if (fromPreference) return expandHome(fromPreference, home);

  const firstFromEnv = env.KUBECONFIG?.split(delimiter)
    .map((entry) => entry.trim())
    .find(Boolean);
  if (firstFromEnv) return expandHome(firstFromEnv, home);

  return join(home, ".kube", "config");
}
