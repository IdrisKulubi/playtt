import { getFriendlyErrorMessage } from "@/lib/api-errors"

export type ToastVariant = "error" | "success" | "info"

export type ToastPayload = {
  id: number
  message: string
  variant: ToastVariant
}

type ToastListener = (toast: ToastPayload) => void

let nextId = 1
let listener: ToastListener | null = null

export function setToastListener(nextListener: ToastListener | null) {
  listener = nextListener
}

function publish(message: string, variant: ToastVariant) {
  listener?.({
    id: nextId++,
    message,
    variant,
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
  apiError(error: unknown, fallback?: string) {
    publish(getFriendlyErrorMessage(error, fallback), "error")
  },
}
