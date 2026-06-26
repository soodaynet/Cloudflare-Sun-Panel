import { ref } from 'vue'

export type ToastType = 'default' | 'success' | 'error' | 'warning' | 'info'
export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export interface ToastOptions {
  description?: string
  type?: ToastType
  duration?: number
}

export interface Toast {
  id: number
  title: string
  description?: string
  type: ToastType
  duration: number
}

const toasts = ref<Toast[]>([])
let counter = 0

function pushToast(title: string, options: ToastOptions = {}): number {
  const id = ++counter
  const duration = options.duration ?? 4000
  const toastItem: Toast = {
    id,
    title,
    description: options.description,
    type: options.type ?? 'default',
    duration,
  }
  toasts.value.push(toastItem)
  // 最多保留 5 条，超出移除最老的
  if (toasts.value.length > 5) {
    toasts.value.splice(0, toasts.value.length - 5)
  }
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration)
  }
  return id
}

function dismiss(id: number) {
  const index = toasts.value.findIndex(t => t.id === id)
  if (index !== -1) {
    toasts.value.splice(index, 1)
  }
}

function dismissToasts(id?: number) {
  if (id !== undefined) {
    dismiss(id)
  }
  else {
    toasts.value = []
  }
}

interface ToastFn {
  (message: string, options?: ToastOptions): number
  success: (message: string, options?: ToastOptions) => number
  error: (message: string, options?: ToastOptions) => number
  warning: (message: string, options?: ToastOptions) => number
  info: (message: string, options?: ToastOptions) => number
  loading: (message: string, options?: ToastOptions) => number
  promise: <T>(promise: Promise<T>, options: {
    loading: string
    success: string | ((data: T) => string)
    error: string | ((error: unknown) => string)
  }) => Promise<T>
  dismiss: (id?: number) => void
}

const toast = ((message: string, options?: ToastOptions) => {
  return pushToast(message, options)
}) as ToastFn

toast.success = (message, options) => pushToast(message, { ...options, type: 'success' })
toast.error = (message, options) => pushToast(message, { ...options, type: 'error' })
toast.warning = (message, options) => pushToast(message, { ...options, type: 'warning' })
toast.info = (message, options) => pushToast(message, { ...options, type: 'info' })
toast.loading = (message, options) => pushToast(message, { ...options, type: 'default', duration: 0 })
toast.dismiss = dismissToasts

toast.promise = <T>(promise: Promise<T>, options: {
  loading: string
  success: string | ((data: T) => string)
  error: string | ((error: unknown) => string)
}) => {
  const id = pushToast(options.loading, { type: 'default', duration: 0 })
  return promise
    .then((data) => {
      dismiss(id)
      const message = typeof options.success === 'function' ? options.success(data) : options.success
      pushToast(message, { type: 'success' })
      return data
    })
    .catch((error) => {
      dismiss(id)
      const message = typeof options.error === 'function' ? options.error(error) : options.error
      pushToast(message, { type: 'error' })
      throw error
    })
}

export function useToast() {
  return {
    toasts,
    toast,
    dismiss,
  }
}

export { toast, dismiss, dismissToasts }
