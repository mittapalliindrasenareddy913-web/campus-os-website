/**
 * Campus OS — Premium Toast Notification System
 * Built on Sonner with consistent styling for all ERP operations.
 */
import { toast } from 'sonner';

type ToastId = string | number;

// ── Core wrappers ──────────────────────────────────────────────
export const toastSuccess = (message: string, description?: string): ToastId =>
  toast.success(message, {
    description,
    duration: 4000,
    classNames: {
      toast: 'campus-toast campus-toast-success',
      title: 'campus-toast-title',
      description: 'campus-toast-desc',
    },
  });

export const toastError = (message: string, description?: string): ToastId =>
  toast.error(message, {
    description,
    duration: 6000,
    classNames: {
      toast: 'campus-toast campus-toast-error',
      title: 'campus-toast-title',
      description: 'campus-toast-desc',
    },
  });

export const toastWarning = (message: string, description?: string): ToastId =>
  toast.warning(message, {
    description,
    duration: 5000,
    classNames: {
      toast: 'campus-toast campus-toast-warning',
      title: 'campus-toast-title',
      description: 'campus-toast-desc',
    },
  });

export const toastInfo = (message: string, description?: string): ToastId =>
  toast.info(message, {
    description,
    duration: 4000,
    classNames: {
      toast: 'campus-toast campus-toast-info',
      title: 'campus-toast-title',
      description: 'campus-toast-desc',
    },
  });

// ── Loading toast (returns ID to dismiss) ─────────────────────
export const toastLoading = (message: string, description?: string): ToastId =>
  toast.loading(message, {
    description,
    classNames: {
      toast: 'campus-toast campus-toast-loading',
      title: 'campus-toast-title',
    },
  });

export const toastDismiss = (id: ToastId) => toast.dismiss(id);

// ── Promise helper (auto success/error from async) ────────────
export const toastPromise = <T>(
  promise: Promise<T>,
  messages: { loading: string; success: string; error?: string }
): Promise<T> => {
  toast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: (err) => messages.error || err?.response?.data?.message || 'Operation failed.',
  });
  return promise;
};

// ── ERP-specific semantic helpers ─────────────────────────────
export const toast_CRUD = {
  created: (entity: string) => toastSuccess(`${entity} created successfully`, 'Changes have been saved and synced.'),
  updated: (entity: string) => toastSuccess(`${entity} updated successfully`, 'Changes have been saved and synced.'),
  deleted: (entity: string) => toastSuccess(`${entity} deleted`, 'Record removed from the system.'),
  error:   (action: string, err?: any) => toastError(
    `Failed: ${action}`,
    err?.response?.data?.message || err?.message || 'Please try again or contact support.'
  ),
  validationError: (msg: string) => toastWarning('Validation Error', msg),
  sessionExpired:  () => toastError('Session Expired', 'Your token has expired. Refreshing your session...'),
};

export { toast };
