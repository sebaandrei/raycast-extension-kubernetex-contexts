/**
 * Error with an optional `action` hint shown to the user
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
 * Error with an optional `action` hint shown to the user
 */
export class KubeconfigError extends Error {
  constructor(
    message: string,
    public action?: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "KubeconfigError";
  }
}
