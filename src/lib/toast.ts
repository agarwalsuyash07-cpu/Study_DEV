// Tiny global toast store; <Toaster /> renders it via useSyncExternalStore.
export type ToastAction = { label: string; ariaLabel?: string; run: () => unknown }
export type Toast = { id: number; message: string; actions: ToastAction[]; tone?: 'error' }

export const TOAST_MS = 5000
const MAX = 3

let toasts: Toast[] = []
let seq = 0
const listeners = new Set<() => void>()
const timers = new Map<number, ReturnType<typeof setTimeout>>()

const emit = () => {
  for (const l of listeners) l()
}
const arm = (id: number) => timers.set(id, setTimeout(() => dismissToast(id), TOAST_MS))

export const getToasts = () => toasts
export function subscribeToasts(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function showToast(t: Omit<Toast, 'id'>): number {
  const id = ++seq
  toasts = [...toasts, { ...t, id }]
  while (toasts.length > MAX) dismissToast(toasts[0]!.id)
  arm(id)
  emit()
  return id
}

export function dismissToast(id: number): void {
  clearTimeout(timers.get(id))
  timers.delete(id)
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

/** Hover/focus pauses the countdown (WCAG 2.2.1); release restarts the full 5 seconds. */
export function holdToast(id: number): void {
  clearTimeout(timers.get(id))
  timers.delete(id)
}
export function releaseToast(id: number): void {
  if (toasts.some((t) => t.id === id) && !timers.has(id)) arm(id)
}
