export const WORKER_MAX_ATTEMPTS = 8
export const WORKER_LEASE_MS = 30_000
export const WORKER_BACKOFF_BASE_MS = 1_000
export const WORKER_BACKOFF_MAX_MS = 15 * 60 * 1000
export const WORKER_CLAIM_LIMIT = 10

export function nextBackoffMs(attempts) {
  const exponent = Math.max(0, attempts - 1)
  return Math.min(
    WORKER_BACKOFF_BASE_MS * 2 ** exponent,
    WORKER_BACKOFF_MAX_MS,
  )
}

export function shouldDeadLetter(attempts) {
  return attempts >= WORKER_MAX_ATTEMPTS
}

export function isLeaseExpired(row, now = new Date()) {
  if (!row.leaseExpiresAt) {
    return true
  }

  return new Date(row.leaseExpiresAt).getTime() <= now.getTime()
}

export function isWorkAvailable(row, now = new Date()) {
  const availableAt = row.availableAt
    ? new Date(row.availableAt).getTime()
    : 0
  return availableAt <= now.getTime() && isLeaseExpired(row, now)
}

export function nextFailureState(attempts, errorMessage, now = new Date()) {
  if (shouldDeadLetter(attempts)) {
    return {
      status: "dead_letter",
      availableAt: now.toISOString(),
      lastError: errorMessage,
      leaseExpiresAt: null,
      leaseOwner: null,
    }
  }

  return {
    status: "failed",
    availableAt: new Date(now.getTime() + nextBackoffMs(attempts)).toISOString(),
    lastError: errorMessage,
    leaseExpiresAt: null,
    leaseOwner: null,
  }
}

export function resolveOutboxConsumer(eventType, eventVersion, registry) {
  const consumer = registry[eventType]

  if (!consumer) {
    return { kind: "unregistered" }
  }

  if (consumer.eventVersion !== eventVersion) {
    return { kind: "unsupported-version" }
  }

  return { kind: "ok", consume: consumer.consume }
}

export function claimableOutboxEventTypes(registry) {
  return Object.entries(registry)
    .filter(([, consumer]) => typeof consumer?.consume === "function")
    .map(([eventType]) => eventType)
}
