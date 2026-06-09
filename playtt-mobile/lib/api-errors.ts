import { ApiError } from "@/lib/api-error"

const CODE_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Your session expired. Please sign in again.",
  SESSION_EXPIRED: "Your session expired. Please sign in again.",
  INVALID_TOKEN: "Your session is no longer valid. Please sign in again.",
  USER_NOT_FOUND: "We could not find your account. Try signing in again.",
  USER_DELETED: "This account is no longer available.",
  USER_BANNED: "This account has been restricted. Contact support if you need help.",
  INVALID_BODY: "We could not read that request. Please try again.",
  VALIDATION_ERROR: "Some details look incorrect. Check the form and try again.",
  INVALID_PHONE: "Enter a valid Kenyan phone number (e.g. 07XX XXX XXX).",
  PHONE_IN_USE: "That phone number is already linked to another account.",
  ONBOARDING_INCOMPLETE: "Complete your player profile before continuing.",
  SLOT_UNAVAILABLE: "That time slot is no longer available. Pick another time.",
  BOOKING_NOT_FOUND: "We could not find that booking.",
  BOOKING_ERROR: "Something went wrong with your booking. Please try again.",
  NETWORK_ERROR: "Cannot reach PlayTT right now. Check your internet connection.",
  TIMEOUT: "That took too long. Check your connection and try again.",
}

const STATUS_MESSAGES: Record<number, string> = {
  400: "Something in that request was not valid. Check your details and try again.",
  401: "Please sign in to continue.",
  403: "You do not have permission to do that.",
  404: "We could not find what you were looking for. It may have been moved or removed.",
  408: "The request timed out. Check your connection and try again.",
  409: "That conflicts with an existing record. Try different details.",
  422: "Some details look incorrect. Check the form and try again.",
  429: "Too many attempts. Please wait a moment and try again.",
  500: "Something went wrong on our side. Please try again shortly.",
  502: "PlayTT is temporarily unavailable. Please try again shortly.",
  503: "PlayTT is temporarily unavailable. Please try again shortly.",
}

function isGenericStatusMessage(message: string) {
  return /^Request failed with status \d+$/.test(message)
}

function isNetworkMessage(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes("network request failed") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("network error")
  )
}

export function formatApiFailure(input: {
  status: number
  code?: string
  message: string
}) {
  if (input.code && CODE_MESSAGES[input.code]) {
    return CODE_MESSAGES[input.code]
  }

  if (!isGenericStatusMessage(input.message)) {
    return input.message
  }

  if (STATUS_MESSAGES[input.status]) {
    return STATUS_MESSAGES[input.status]
  }

  return input.message
}

export function getFriendlyErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
) {
  if (error instanceof ApiError) {
    if (error.code && CODE_MESSAGES[error.code]) {
      return CODE_MESSAGES[error.code]
    }

    if (error.message && !isGenericStatusMessage(error.message)) {
      return error.message
    }

    if (STATUS_MESSAGES[error.status]) {
      return STATUS_MESSAGES[error.status]
    }
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return CODE_MESSAGES.TIMEOUT
    }

    if (isNetworkMessage(error.message)) {
      return CODE_MESSAGES.NETWORK_ERROR
    }

    if (error.message.trim()) {
      return error.message
    }
  }

  if (typeof error === "string" && error.trim()) {
    return error
  }

  return fallback
}
