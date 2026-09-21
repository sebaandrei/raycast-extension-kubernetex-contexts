import { showToast, Toast } from "@raycast/api";
import { KubeconfigError, ValidationError } from "./kubeconfig-errors";

export { KubeconfigError, ValidationError };

/**
 * Enhanced error types for better user guidance
 */
export interface KubeError {
  type: "kubeconfig" | "context" | "permission" | "file" | "yaml" | "network" | "validation" | "unknown";
  title: string;
  message: string;
  action?: string;
}

/**
 * Analyzes error and returns structured error information
 */
function analyzeError(error: Error): KubeError {
  const errorMsg = error.message.toLowerCase();

  // File system errors
  if (errorMsg.includes("enoent") || errorMsg.includes("not found")) {
    return {
      type: "file",
      title: "Kubeconfig Not Found",
      message: "No kubeconfig file found",
      action: "Create a kubeconfig file or check your Kubernetes setup",
    };
  }

  if (errorMsg.includes("eacces") || errorMsg.includes("permission denied")) {
    return {
      type: "permission",
      title: "Permission Denied",
      message: "Cannot access the kubeconfig file",
      action: "Check the file permissions of your kubeconfig",
    };
  }

  // YAML parsing errors
  if (errorMsg.includes("yaml") || errorMsg.includes("parse") || errorMsg.includes("syntax")) {
    return {
      type: "yaml",
      title: "Invalid Kubeconfig",
      message: "Kubeconfig file contains invalid YAML",
      action: "Check your kubeconfig syntax or regenerate the file",
    };
  }

  // Context-specific errors
  if (errorMsg.includes("context") && (errorMsg.includes("not found") || errorMsg.includes("does not exist"))) {
    return {
      type: "context",
      title: "Context Not Found",
      message: "The specified context does not exist",
      action: "Check available contexts or update your kubeconfig",
    };
  }

  if (errorMsg.includes("context") && errorMsg.includes("already exists")) {
    return {
      type: "validation",
      title: "Context Already Exists",
      message: "A context with this name already exists",
      action: "Choose a different name or modify the existing context",
    };
  }

  // Network/cluster errors
  if (errorMsg.includes("timeout") || errorMsg.includes("network") || errorMsg.includes("connection")) {
    return {
      type: "network",
      title: "Connection Error",
      message: "Unable to connect to cluster",
      action: "Check your network connection and cluster availability",
    };
  }

  // Validation errors
  if (errorMsg.includes("required") || errorMsg.includes("invalid") || errorMsg.includes("validation")) {
    return {
      type: "validation",
      title: "Validation Error",
      message: error.message,
      action: "Please check your input and try again",
    };
  }

  // Kubeconfig structure errors
  if (errorMsg.includes("kubeconfig") || errorMsg.includes("cluster") || errorMsg.includes("user")) {
    return {
      type: "kubeconfig",
      title: "Kubeconfig Error",
      message: error.message,
      action: "Verify your kubeconfig file structure",
    };
  }

  // Generic error
  return {
    type: "unknown",
    title: "Unexpected Error",
    message: error.message,
    action: "Please try again or check the logs",
  };
}

/**
 * Shows an enhanced error toast with actionable guidance
 */
export async function showErrorToast(error: Error): Promise<void> {
  // Typed errors already carry a specific message and next step
  const kubeError: KubeError =
    error instanceof KubeconfigError || error instanceof ValidationError
      ? {
          type: error instanceof ValidationError ? "validation" : "kubeconfig",
          title: error instanceof ValidationError ? "Validation Error" : "Kubeconfig Error",
          message: error.message,
          action: error.action,
        }
      : analyzeError(error);

  await showToast({
    style: Toast.Style.Failure,
    title: kubeError.title,
    message: kubeError.action ? `${kubeError.message}\n${kubeError.action}` : kubeError.message,
  });
}

/**
 * Shows a success toast
 */
export async function showSuccessToast(title: string, message?: string): Promise<void> {
  await showToast({
    style: Toast.Style.Success,
    title,
    message,
  });
}

/**
 * Shows an informational toast
 */
export async function showInfoToast(title: string, message?: string): Promise<void> {
  await showToast({
    style: Toast.Style.Animated,
    title,
    message,
  });
}

/**
 * Shows a warning toast with actionable guidance
 */
export async function showWarningToast(title: string, message: string, action?: string): Promise<void> {
  await showToast({
    style: Toast.Style.Failure,
    title: title,
    message: action ? `${message}\n${action}` : message,
  });
}

/**
 * Shows a loading toast that can be updated
 */
export async function showLoadingToast(title: string, message?: string): Promise<Toast> {
  return await showToast({
    style: Toast.Style.Animated,
    title,
    message,
  });
}
