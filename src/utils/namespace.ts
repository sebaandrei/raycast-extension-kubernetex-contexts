const RFC_1123_LABEL = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
export const MAX_NAMESPACE_LENGTH = 63;

/**
 * Validate a Kubernetes namespace name (RFC 1123 label).
 * Returns an error message, or undefined when valid.
 */
export function validateNamespace(name: string): string | undefined {
  if (!name.trim()) return "Namespace cannot be empty";
  if (name.length > MAX_NAMESPACE_LENGTH) return `Namespace must be at most ${MAX_NAMESPACE_LENGTH} characters`;
  if (!RFC_1123_LABEL.test(name)) {
    return "Use lowercase letters, numbers and '-' only; start and end with a letter or number";
  }
  return undefined;
}
