import { toast as sonnerToast } from "sonner";

/**
 * Show a persistent error toast that remains until dismissed.
 * Supports multiple toasts - each error adds a new toast to the stack.
 *
 * Use for API/RPC errors where the user needs to acknowledge the failure.
 */
export function toastError(
  message: string,
  options?: { description?: string; code?: string }
) {
  const title = options?.code ? `${options.code}: ${message}` : message;
  sonnerToast.error(title, {
    duration: Infinity,
    description: options?.description,
    dismissible: true,
  });
}

/**
 * Show a transient success toast.
 */
export function toastSuccess(
  message: string,
  options?: { description?: string }
) {
  sonnerToast.success(message, {
    description: options?.description,
  });
}
