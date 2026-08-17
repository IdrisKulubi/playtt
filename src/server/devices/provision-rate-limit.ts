const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 10

const attempts = new Map<string, { count: number; windowStart: number }>

export function checkProvisionRateLimit(key: string) {
  const now = Date.now()
  const entry = attempts.get(key)

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now })
    return true
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return false
  }

  entry.count += 1
  return true
}

export function resetProvisionRateLimit(key: string) {
  attempts.delete(key)
}
