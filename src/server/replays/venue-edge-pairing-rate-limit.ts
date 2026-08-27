import { sql } from "drizzle-orm"

import db from "@/db/drizzle"
import { venueEdgePairingRateLimits } from "@/db/schema"
import { DeviceError } from "@/server/devices/errors"
import { hashPairingRateLimitSubject } from "@/server/replays/venue-edge-pairing-credentials"

export const PAIRING_CREATE_RATE_LIMIT = {
  scope: "venue_edge_pairing_create",
  windowMs: 15 * 60 * 1000,
  maxAttempts: 10,
} as const

export const PAIRING_LOOKUP_RATE_LIMIT = {
  scope: "venue_edge_pairing_lookup",
  windowMs: 60 * 1000,
  maxAttempts: 5,
} as const

type RateLimitTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

type RedisRateLimitClient = {
  connect(): Promise<void>
  incr(key: string): Promise<number>
  pExpire(key: string, milliseconds: number): Promise<number | boolean>
  quit(): Promise<void>
}

function windowStart(now: Date, windowMs: number) {
  const epochMs = now.getTime()
  return new Date(Math.floor(epochMs / windowMs) * windowMs)
}

async function incrementRateLimitCounter(
  executor: typeof db | RateLimitTransaction,
  input: {
    scope: string
    subject: string
    windowMs: number
    maxAttempts: number
    now?: Date
  },
) {
  const now = input.now ?? new Date()
  const windowStartedAt = windowStart(now, input.windowMs)
  const subjectHash = hashPairingRateLimitSubject(input.subject)

  const redisAllowed = await tryRedisRateLimit({
    scope: input.scope,
    subjectHash,
    windowMs: input.windowMs,
    maxAttempts: input.maxAttempts,
    now,
  })

  if (redisAllowed === false) {
    throw new DeviceError(
      "PAIRING_RATE_LIMITED",
      "Too many pairing attempts. Try again later.",
      429,
    )
  }

  const [row] = await executor
    .insert(venueEdgePairingRateLimits)
    .values({
      scope: input.scope,
      subjectHash,
      windowStartedAt,
      count: 1,
    })
    .onConflictDoUpdate({
      target: [
        venueEdgePairingRateLimits.scope,
        venueEdgePairingRateLimits.subjectHash,
        venueEdgePairingRateLimits.windowStartedAt,
      ],
      set: {
        count: sql`${venueEdgePairingRateLimits.count} + 1`,
        updatedAt: now,
      },
    })
    .returning({ count: venueEdgePairingRateLimits.count })

  if (!row || row.count > input.maxAttempts) {
    throw new DeviceError(
      "PAIRING_RATE_LIMITED",
      "Too many pairing attempts. Try again later.",
      429,
    )
  }

  return row.count
}

async function tryRedisRateLimit(input: {
  scope: string
  subjectHash: string
  windowMs: number
  maxAttempts: number
  now: Date
}): Promise<boolean | null> {
  const redisUrl = process.env.REDIS_URL?.trim()
  if (!redisUrl) {
    return null
  }

  try {
    // Keep Redis optional and isolate its richer command surface from the
    // narrower ambient type used by the realtime adapter.
    const loadModule = new Function(
      "specifier",
      "return import(specifier)",
    ) as (specifier: string) => Promise<{
      createClient(options: { url: string }): RedisRateLimitClient
    }>
    const module = await loadModule("redis")
    const createClient = module.createClient

    if (!createClient) {
      return null
    }

    const client = createClient({ url: redisUrl })
    await client.connect()

    try {
      const key = `venue-edge-pairing:${input.scope}:${input.subjectHash}`
      const count = await client.incr(key)
      if (count === 1) {
        await client.pExpire(key, input.windowMs)
      }

      if (count > input.maxAttempts) {
        return false
      }
    } finally {
      await client.quit()
    }
  } catch {
    return null
  }

  return null
}

export async function assertPairingCreateAllowed(
  input: { tenantId: string; locationId: string; now?: Date },
  executor: typeof db | RateLimitTransaction = db,
) {
  await incrementRateLimitCounter(executor, {
    scope: PAIRING_CREATE_RATE_LIMIT.scope,
    subject: `${input.tenantId}:${input.locationId}`,
    windowMs: PAIRING_CREATE_RATE_LIMIT.windowMs,
    maxAttempts: PAIRING_CREATE_RATE_LIMIT.maxAttempts,
    now: input.now,
  })
}

export async function recordFailedPairingLookup(
  input: { subject: string; now?: Date },
  executor: typeof db | RateLimitTransaction = db,
) {
  await incrementRateLimitCounter(executor, {
    scope: PAIRING_LOOKUP_RATE_LIMIT.scope,
    subject: input.subject,
    windowMs: PAIRING_LOOKUP_RATE_LIMIT.windowMs,
    maxAttempts: PAIRING_LOOKUP_RATE_LIMIT.maxAttempts,
    now: input.now,
  })
}
