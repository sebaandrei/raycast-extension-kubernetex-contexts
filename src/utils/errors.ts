import { showToast, Toast } from "@raycast/api";

/**
 * Shows an error toast with appropriate styling and message
 */
export async function showErrorToast(error: Error): Promise<void> {
  let title = "Error";
  let message = error.message;

  // Customize error messages based on error content
  if (error.message.includes("kubeconfig")) {
    title = "Kubeconfig Error";
  } else if (error.message.includes("context")) {
    title = "Context Error";
  } else if (error.message.includes("permission denied") || error.message.includes("EACCES")) {
    title = "Permission Denied";
    message = "Check file permissions for ~/.kube/config";
  } else if (error.message.includes("ENOENT")) {
    title = "File Not Found";
    message = "Kubeconfig file not found at ~/.kube/config";
  }

  await showToast({
    style: Toast.Style.Failure,
    title,
    message,
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