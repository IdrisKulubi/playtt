import { getFriendlyErrorMessage } from "@/lib/api-errors"

export type ToastVariant = "error" | "success" | "info"

export type ToastAction = {
  label: string
  onPress: () => void
}

export type ToastPayload = {
  id: number
  message: string
  variant: ToastVariant
  action?: ToastAction
  durationMs?: number
}

/** Undo toasts stay long enough to read and react: 5 s. */
export const UNDO_TOAST_DURATION_MS = 5000

type ToastListener = (toast: ToastPayload) => void

let nextId = 1
let listener: ToastListener | null = null

export function setToastListener(nextListener: ToastListener | null) {
  listener = nextListener
}

function publish(
  message: string,
  variant: ToastVariant,
  extra?: Pick<ToastPayload, "action" | "durationMs">,
) {
  listener?.({
    id: nextId++,
    message,
    variant,
    ...extra,
  })
}

export const toast = {
  error(message: string) {
    publish(message, "error")
  },
  success(message: string) {
    publish(message, "success")
  },
  info(message: string) {
    publish(message, "info")
  },
  /** Forgiveness over confirmation: do the thing, then offer Undo for 5 s. */
  undo(message: string, onUndo: () => void) {
    publish(message, "info", {
      action: { label: "Undo", onPress: onUndo },
      durationMs: UNDO_TOAST_DURATION_MS,
    })
  },
  apiError(error: unknown, fallback?: string) {
    publish(getFriendlyErrorMessage(error, fallback), "error")
  },
}
