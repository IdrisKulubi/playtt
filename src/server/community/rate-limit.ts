import { COMMUNITY_RATE_LIMITS, type CommunityRateLimitScope } from "./constants.ts"

// Per-process limiter, same approach as src/server/devices/provision-rate-limit.ts.
// Good enough for the pilot; move to Redis if we run many instances.
const hits = new Map<string, { count: number; windowStart: number }>()

export function consumeCommunityRateLimit(
  scope: CommunityRateLimitScope,
  userId: string,
  now = Date.now(),
) {
  const { max, windowMs } = COMMUNITY_RATE_LIMITS[scope]
  const key = `${scope}:${userId}`
  const entry = hits.get(key)

  if (!entry || now - entry.windowStart >= windowMs) {
    hits.set(key, { count: 1, windowStart: now })
    return true
  }

  if (entry.count >= max) {
    return false
  }

  entry.count += 1
  return true
}

export function resetCommunityRateLimits() {
  hits.clear()
}
