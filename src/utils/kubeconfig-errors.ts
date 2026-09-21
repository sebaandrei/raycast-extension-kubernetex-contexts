/**
 * Creates user-friendly validation errors
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public action?: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Creates user-friendly kubeconfig errors
 */
export class KubeconfigError extends Error {
  constructor(
    message: string,
    public action?: string
  ) {
    super(message);
    this.name = "KubeconfigError";
  }
}
