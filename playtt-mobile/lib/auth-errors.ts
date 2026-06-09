import { getFriendlyErrorMessage } from "@/lib/api-errors"

export function formatAuthError(message: string): string {
  return getFriendlyErrorMessage(
    new Error(message),
    message,
  )
}
