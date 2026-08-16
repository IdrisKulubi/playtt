const POSTGRES_EXCLUSION_VIOLATION = "23P01"
const BOOKINGS_OVERLAP_CONSTRAINT = "bookings_no_overlap"

type ErrorRecord = {
  cause?: unknown
  code?: unknown
  constraint?: unknown
}

export function isBookingOverlapConflict(error: unknown) {
  let current = error

  for (let depth = 0; depth < 5; depth += 1) {
    if (!current || typeof current !== "object") {
      return false
    }

    const candidate = current as ErrorRecord

    if (
      candidate.code === POSTGRES_EXCLUSION_VIOLATION &&
      (candidate.constraint === undefined ||
        candidate.constraint === BOOKINGS_OVERLAP_CONSTRAINT)
    ) {
      return true
    }

    current = candidate.cause
  }

  return false
}
