import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import {
  canTransitionPlaySession,
  initialPlaySessionStatusForBooking,
  playSessionTimestampUpdatesForTransition,
  shouldCreatePlaySessionForBooking,
} from "./state-machine.mjs"

const repoRoot = join(import.meta.dirname, "..", "..", "..")
const sessionsRoot = import.meta.dirname
const schemaSource = readFileSync(join(repoRoot, "db", "schema.ts"), "utf8")
const migrationSource = readFileSync(
  join(repoRoot, "drizzle", "0014_play_sessions.sql"),
  "utf8",
)
const backfillSource = readFileSync(
  join(repoRoot, "db", "backfill-play-sessions.sql"),
  "utf8",
)

test("schema defines operational play_sessions separate from Better Auth session", () => {
  assert.match(schemaSource, /export const playSessions = pgTable/)
  assert.match(schemaSource, /session_participants/)
  assert.match(schemaSource, /play_session_status/)
  assert.match(schemaSource, /play_sessions_booking_id_unique/)
  assert.match(schemaSource, /play_session_id/)
  assert.match(schemaSource, /export const session = pgTable/)
})

test("migration adds tenant-scoped composite foreign keys and compatibility links", () => {
  assert.match(migrationSource, /play_sessions_tenant_booking_fk/)
  assert.match(migrationSource, /play_sessions_tenant_location_fk/)
  assert.match(migrationSource, /play_sessions_tenant_resource_fk/)
  assert.match(migrationSource, /session_participants_tenant_play_session_fk/)
  assert.match(migrationSource, /ADD COLUMN "play_session_id"/)
})

test("backfill is idempotent for sessions, participants, and child links", () => {
  assert.match(backfillSource, /where not exists/i)
  assert.match(backfillSource, /status in \('confirmed', 'completed'\)/i)
  assert.match(backfillSource, /payment_status = 'paid'/i)
  assert.match(backfillSource, /update matches/i)
  assert.match(backfillSource, /update access_credentials/i)
  assert.match(backfillSource, /update session_events/i)
  assert.match(backfillSource, /update replays/i)
})

test("state machine allows only legal transitions and idempotent repeats", () => {
  assert.deepEqual(canTransitionPlaySession("confirmed", "confirmed"), {
    ok: true,
    idempotent: true,
  })
  assert.deepEqual(canTransitionPlaySession("confirmed", "preparing"), {
    ok: true,
    idempotent: false,
  })
  assert.deepEqual(canTransitionPlaySession("confirmed", "active"), {
    ok: false,
    code: "ILLEGAL_SESSION_TRANSITION",
  })
  assert.deepEqual(canTransitionPlaySession("available", "confirmed"), {
    ok: false,
    code: "ILLEGAL_SESSION_TRANSITION",
  })
})

test("initial session status follows booking status for paid bookings", () => {
  assert.equal(initialPlaySessionStatusForBooking("confirmed"), "confirmed")
  assert.equal(initialPlaySessionStatusForBooking("completed"), "completed")
  assert.equal(initialPlaySessionStatusForBooking("pending"), null)
  assert.equal(
    shouldCreatePlaySessionForBooking({
      status: "confirmed",
      paymentStatus: "paid",
    }),
    true,
  )
  assert.equal(
    shouldCreatePlaySessionForBooking({
      status: "confirmed",
      paymentStatus: "unpaid",
    }),
    false,
  )
})

test("transition timestamps stamp lifecycle milestones", () => {
  const at = new Date("2026-08-17T12:00:00.000Z")
  assert.deepEqual(playSessionTimestampUpdatesForTransition("preparing", at), {
    preparedAt: at,
  })
  assert.deepEqual(playSessionTimestampUpdatesForTransition("active", at), {
    startedAt: at,
  })
  assert.deepEqual(playSessionTimestampUpdatesForTransition("available", at), {
    resetAt: at,
  })
})

test("repository scopes lookups by tenant context", () => {
  const source = readFileSync(join(sessionsRoot, "play-sessions.ts"), "utf8")
  assert.match(source, /eq\(playSessions\.tenantId, context\.tenantId\)/)
  assert.match(source, /onConflictDoNothing/)
})

test("service audits illegal transitions without mutating state", () => {
  const source = readFileSync(join(sessionsRoot, "service.ts"), "utf8")
  assert.match(source, /play_session\.transition\.rejected/)
  assert.match(source, /ILLEGAL_SESSION_TRANSITION/)
})

test("payment confirmation writes session and outbox events inside the transaction", () => {
  const source = readFileSync(
    join(repoRoot, "src", "server", "payments", "confirm-booking.ts"),
    "utf8",
  )
  assert.match(source, /writeConfirmationDurableSideEffects/)
  assert.match(source, /repairConfirmationDurableSideEffects/)
  assert.doesNotMatch(source, /schedulePlaySessionEnsure/)

  const transactionBody = source.match(
    /db\.transaction\(async \(tx\) => \{([\s\S]*?)\n  \}\)/,
  )?.[1]

  assert.ok(transactionBody)
  assert.match(transactionBody, /writeConfirmationDurableSideEffects\(tx/)
  assert.doesNotMatch(transactionBody, /sendBookingConfirmationEmail/)
})

test("getPlaySessionByBookingId returns null for other-tenant booking ids when database is seeded", async (t) => {
  if (!process.env.POSTGRES_URL) {
    t.skip("POSTGRES_URL is not configured")
    return
  }

  const { getPlaySessionByBookingId } = await import("./play-sessions.ts")
  const { PLAYTT_TENANT_ID } = await import("../tenancy/constants.ts")

  const otherTenantContext = {
    tenantId: "00000000-0000-0000-0000-000000000001",
    actor: { type: "service", id: "sessions-test" },
    correlationId: "corr-sessions-tenant",
  }

  const result = await getPlaySessionByBookingId(
    otherTenantContext,
    "00000000-0000-0000-0000-000000000099",
  )

  assert.equal(result, null)

  const ownTenantResult = await getPlaySessionByBookingId(
    {
      tenantId: PLAYTT_TENANT_ID,
      actor: { type: "service", id: "sessions-test" },
      correlationId: "corr-sessions-own",
    },
    "00000000-0000-0000-0000-000000000099",
  )

  assert.equal(ownTenantResult, null)
})
