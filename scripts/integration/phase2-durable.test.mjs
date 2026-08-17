import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, before, test } from "node:test"

import {
  WORKER_MAX_ATTEMPTS,
  nextFailureState,
} from "../../src/server/workers/backoff.mjs"
import { CLAIM_INBOX_SQL } from "../../src/server/workers/claim-sql.mjs"
import {
  processClaimedInboxRow,
  processClaimedOutboxRow,
} from "../../src/server/workers/run-durable-work.mjs"
import { hashWebhookPayload } from "../../src/server/payments/webhook-inbox-utils.mjs"
import {
  createDisposableMigrationHarness,
  hasIntegrationDatabase,
} from "../lib/disposable-migration-harness.mjs"

let harness
let originalPostgresUrl

before(async () => {
  if (!hasIntegrationDatabase()) {
    return
  }

  originalPostgresUrl = process.env.POSTGRES_URL
  process.env.POSTGRES_URL = process.env.PLAYTT_TEST_DATABASE_URL

  harness = await createDisposableMigrationHarness()
  await harness.applyAllMigrationsAndSeed()
})

after(async () => {
  if (originalPostgresUrl === undefined) {
    delete process.env.POSTGRES_URL
  } else {
    process.env.POSTGRES_URL = originalPostgresUrl
  }

  await harness?.teardown()
})

async function insertInboxRow(sql, input = {}) {
  const rawPayload = input.rawPayload ?? JSON.stringify({ event: "charge.success" })
  const payloadHash = hashWebhookPayload(rawPayload)

  const [row] = await sql`
    insert into payment_webhook_inbox (
      provider,
      provider_event_id,
      payload_hash,
      signature,
      event_type,
      raw_payload,
      status,
      available_at
    ) values (
      'paystack',
      ${input.providerEventId ?? `evt:${randomUUID()}`},
      ${payloadHash},
      'sig',
      'charge.success',
      ${rawPayload},
      ${input.status ?? "received"},
      now()
    )
    returning id, attempts
  `

  return row
}

async function claimInboxWork(sql, { limit = 1, owner = "worker-a", leaseMs = 30_000 } = {}) {
  const leaseExpiresAt = new Date(Date.now() + leaseMs)

  return sql.begin(async (tx) => {
    const selected = await tx.unsafe(CLAIM_INBOX_SQL, [limit])
    const claimed = []

    for (const row of selected) {
      const [updated] = await tx`
        update payment_webhook_inbox
        set
          status = 'processing',
          lease_owner = ${owner},
          lease_expires_at = ${leaseExpiresAt},
          attempts = attempts + 1,
          updated_at = now()
        where id = ${row.id}
        returning id, attempts, lease_owner
      `

      if (updated) {
        claimed.push(updated)
      }
    }

    return claimed
  })
}

async function insertConfirmedBooking(sql) {
  const userId = `user-${randomUUID()}`
  const email = `${userId}@example.test`
  const bookingId = randomUUID()
  const tenantId = "33333333-3333-3333-3333-333333333333"

  await sql`
    insert into "user" (id, name, email, email_verified)
    values (${userId}, 'Phase 2 Test', ${email}, true)
  `

  const [location] = await sql`
    select id
    from locations
    where tenant_id = ${tenantId}
    limit 1
  `
  const [resource] = await sql`
    select id
    from resources
    where tenant_id = ${tenantId}
      and location_id = ${location.id}
    limit 1
  `

  await sql`
    insert into bookings (
      id,
      tenant_id,
      location_id,
      resource_id,
      user_id,
      status,
      payment_status,
      start_time,
      end_time,
      duration_minutes,
      group_size,
      currency,
      subtotal_amount,
      discount_amount,
      total_amount,
      confirmed_at
    ) values (
      ${bookingId},
      ${tenantId},
      ${location.id},
      ${resource.id},
      ${userId},
      'confirmed',
      'paid',
      now() + interval '1 hour',
      now() + interval '2 hours',
      60,
      2,
      'KES',
      1000.00,
      0.00,
      1000.00,
      now()
    )
  `

  return { bookingId, tenantId, locationId: location.id, resourceId: resource.id }
}

async function insertOutboxRow(sql, input = {}) {
  const idempotencyKey =
    input.idempotencyKey ?? `payment.confirmed.v1:${randomUUID()}`

  const [row] = await sql`
    insert into outbox_events (
      aggregate_type,
      aggregate_id,
      event_type,
      event_version,
      correlation_id,
      payload,
      idempotency_key,
      status,
      available_at
    ) values (
      ${input.aggregateType ?? "payment"},
      ${input.aggregateId ?? randomUUID()},
      ${input.eventType ?? "payment.confirmed.v1"},
      1,
      ${input.correlationId ?? randomUUID()},
      ${sql.json(input.payload ?? { bookingId: randomUUID() })},
      ${idempotencyKey},
      ${input.status ?? "pending"},
      now()
    )
    on conflict (idempotency_key) do nothing
    returning id, idempotency_key
  `

  return row ?? null
}

test("duplicate signed webhook payloads create one inbox identity", async (t) => {
  if (!hasIntegrationDatabase()) {
    t.skip("PLAYTT_TEST_DATABASE_URL is not configured")
    return
  }

  const rawPayload = JSON.stringify({ event: "charge.success", data: { id: 42 } })
  const payloadHash = hashWebhookPayload(rawPayload)

  await harness.sql`
    insert into payment_webhook_inbox (
      provider, payload_hash, signature, event_type, raw_payload, status
    ) values (
      'paystack', ${payloadHash}, 'sig', 'charge.success', ${rawPayload}, 'received'
    )
    on conflict (provider, payload_hash) do nothing
  `

  await harness.sql`
    insert into payment_webhook_inbox (
      provider, payload_hash, signature, event_type, raw_payload, status
    ) values (
      'paystack', ${payloadHash}, 'sig', 'charge.success', ${rawPayload}, 'received'
    )
    on conflict (provider, payload_hash) do nothing
  `

  const [count] = await harness.sql`
    select count(*)::int as count
    from payment_webhook_inbox
    where provider = 'paystack' and payload_hash = ${payloadHash}
  `

  assert.equal(count.count, 1)
})

test("inbox claims use skip locked so only one worker owns a row", async (t) => {
  if (!hasIntegrationDatabase()) {
    t.skip("PLAYTT_TEST_DATABASE_URL is not configured")
    return
  }

  await insertInboxRow(harness.sql)

  const [firstClaim, secondClaim] = await Promise.all([
    claimInboxWork(harness.sql, { owner: "worker-a" }),
    claimInboxWork(harness.sql, { owner: "worker-b" }),
  ])

  assert.equal(firstClaim.length + secondClaim.length, 1)
})

test("expired inbox leases can be reclaimed", async (t) => {
  if (!hasIntegrationDatabase()) {
    t.skip("PLAYTT_TEST_DATABASE_URL is not configured")
    return
  }

  const row = await insertInboxRow(harness.sql)
  const past = new Date(Date.now() - 60_000)

  await harness.sql`
    update payment_webhook_inbox
    set
      status = 'processing',
      lease_owner = 'stale-worker',
      lease_expires_at = ${past},
      attempts = 1
    where id = ${row.id}
  `

  const reclaimed = await claimInboxWork(harness.sql, { owner: "worker-retry" })
  assert.equal(reclaimed.length, 1)
  assert.equal(reclaimed[0].id, row.id)
})

test("confirmation side effects stay unique across payment, session, and outbox", async (t) => {
  if (!hasIntegrationDatabase()) {
    t.skip("PLAYTT_TEST_DATABASE_URL is not configured")
    return
  }

  const { bookingId, tenantId, locationId, resourceId } =
    await insertConfirmedBooking(harness.sql)
  const paymentId = randomUUID()
  const sessionId = randomUUID()

  const firstOutbox = await insertOutboxRow(harness.sql, {
    aggregateId: paymentId,
    idempotencyKey: `payment.confirmed.v1:${paymentId}`,
    payload: { bookingId, paymentId },
  })
  const duplicateOutbox = await insertOutboxRow(harness.sql, {
    aggregateId: paymentId,
    idempotencyKey: `payment.confirmed.v1:${paymentId}`,
    payload: { bookingId, paymentId },
  })

  assert.ok(firstOutbox)
  assert.equal(duplicateOutbox, null)

    await harness.sql`
      insert into play_sessions (
        id,
        tenant_id,
        booking_id,
        location_id,
        resource_id,
        status,
        correlation_id,
        scheduled_start_at,
        scheduled_end_at,
        configuration_snapshot
      ) values (
        ${sessionId},
        ${tenantId},
        ${bookingId},
        ${locationId},
        ${resourceId},
        'confirmed',
        ${randomUUID()},
        now() + interval '1 hour',
        now() + interval '2 hours',
        '{}'::jsonb
      )
    `

  let duplicateSessionRejected = false
  try {
    await harness.sql`
      insert into play_sessions (
        id,
        tenant_id,
        booking_id,
        location_id,
        resource_id,
        status,
        correlation_id,
        scheduled_start_at,
        scheduled_end_at,
        configuration_snapshot
      ) values (
        ${randomUUID()},
        ${tenantId},
        ${bookingId},
        ${locationId},
        ${resourceId},
        'confirmed',
        ${randomUUID()},
        now() + interval '1 hour',
        now() + interval '2 hours',
        '{}'::jsonb
      )
    `
  } catch (error) {
    duplicateSessionRejected = error?.code === "23505"
  }

  assert.equal(duplicateSessionRejected, true)
})

test("outbox consumer failures dead-letter and replay without duplicating work", async (t) => {
  if (!hasIntegrationDatabase()) {
    t.skip("PLAYTT_TEST_DATABASE_URL is not configured")
    return
  }

  const row = await insertOutboxRow(harness.sql)
  assert.ok(row)

  let attempts = 0
  for (let currentAttempt = 1; currentAttempt <= WORKER_MAX_ATTEMPTS; currentAttempt += 1) {
  const result = await processClaimedOutboxRow({
      row: {
        id: row.id,
        eventType: "payment.confirmed.v1",
        eventVersion: 1,
        attempts: currentAttempt,
      },
      registry: {
        "payment.confirmed.v1": {
          eventVersion: 1,
          consume: async () => {
            attempts += 1
            throw new Error("consumer failed")
          },
        },
      },
      markProcessed: async () => {},
      markRetryOrDeadLetter: async (_id, next) => {
        await harness.sql`
          update outbox_events
          set
            status = ${next.status},
            available_at = ${new Date(next.availableAt)},
            last_error = ${next.lastError},
            lease_expires_at = null,
            lease_owner = null,
            updated_at = now()
          where id = ${row.id}
        `
      },
    })

    if (currentAttempt < WORKER_MAX_ATTEMPTS) {
      assert.equal(result.outcome, "failed")
    } else {
      assert.equal(result.outcome, "dead_letter")
    }
  }

  assert.equal(attempts, WORKER_MAX_ATTEMPTS)

  const [dead] = await harness.sql`
    select status, processed_at
    from outbox_events
    where id = ${row.id}
  `
  assert.equal(dead.status, "dead_letter")

  await harness.sql`
    update outbox_events
    set
      status = 'pending',
      available_at = now(),
      last_error = null,
      lease_expires_at = null,
      lease_owner = null,
      processed_at = null
    where id = ${row.id}
  `

  const replayed = await processClaimedOutboxRow({
    row: {
      id: row.id,
      eventType: "payment.confirmed.v1",
      eventVersion: 1,
      attempts: 1,
    },
    registry: {
      "payment.confirmed.v1": {
        eventVersion: 1,
        consume: async () => {},
      },
    },
    markProcessed: async (id) => {
      await harness.sql`
        update outbox_events
        set status = 'processed', processed_at = now()
        where id = ${id}
      `
    },
    markRetryOrDeadLetter: async () => {
      throw new Error("should not retry after successful replay")
    },
  })

  assert.equal(replayed.outcome, "processed")

  const [processed] = await harness.sql`
    select status
    from outbox_events
    where id = ${row.id}
  `
  assert.equal(processed.status, "processed")
})

test("inbox handler failures retry then dead-letter and replay safely", async (t) => {
  if (!hasIntegrationDatabase()) {
    t.skip("PLAYTT_TEST_DATABASE_URL is not configured")
    return
  }

  const inboxRow = await insertInboxRow(harness.sql)
  let handlerCalls = 0

  for (let currentAttempt = 1; currentAttempt <= WORKER_MAX_ATTEMPTS; currentAttempt += 1) {
    const result = await processClaimedInboxRow({
      row: {
        id: inboxRow.id,
        attempts: currentAttempt,
        rawPayload: JSON.stringify({ event: "charge.success" }),
      },
      handleEvent: async () => {
        handlerCalls += 1
        throw new Error("handler failed")
      },
      markProcessed: async () => {},
      markRetryOrDeadLetter: async (_id, next) => {
        await harness.sql`
          update payment_webhook_inbox
          set
            status = ${next.status},
            available_at = ${new Date(next.availableAt)},
            last_error = ${next.lastError},
            lease_expires_at = null,
            lease_owner = null,
            updated_at = now()
          where id = ${inboxRow.id}
        `
      },
    })

    if (currentAttempt < WORKER_MAX_ATTEMPTS) {
      assert.equal(result.outcome, "failed")
    } else {
      assert.equal(result.outcome, "dead_letter")
    }
  }

  assert.equal(handlerCalls, WORKER_MAX_ATTEMPTS)

  await harness.sql`
    update payment_webhook_inbox
    set
      status = 'received',
      available_at = now(),
      last_error = null,
      processed_at = null
    where id = ${inboxRow.id}
  `

  const replay = await processClaimedInboxRow({
    row: {
      id: inboxRow.id,
      attempts: 1,
      rawPayload: JSON.stringify({ event: "charge.success" }),
    },
    handleEvent: async () => {},
    markProcessed: async (id) => {
      await harness.sql`
        update payment_webhook_inbox
        set status = 'processed', processed_at = now()
        where id = ${id}
      `
    },
    markRetryOrDeadLetter: async () => {
      throw new Error("should not retry after successful replay")
    },
  })

  assert.equal(replay.outcome, "processed")
})

test("lifecycle scheduler idempotency key prevents duplicate intents", async (t) => {
  if (!hasIntegrationDatabase()) {
    t.skip("PLAYTT_TEST_DATABASE_URL is not configured")
    return
  }

  const { sessionLifecycleIdempotencyKey } = await import(
    "../../src/server/sessions/lifecycle-schedule.mjs"
  )

  const playSessionId = randomUUID()
  const idempotencyKey = sessionLifecycleIdempotencyKey(
    "session.preparing.v1",
    playSessionId,
    "preparing",
  )

  const first = await insertOutboxRow(harness.sql, {
    eventType: "session.preparing.v1",
    aggregateType: "play_session",
    aggregateId: playSessionId,
    idempotencyKey,
    payload: { playSessionId, toStatus: "preparing" },
  })
  const second = await insertOutboxRow(harness.sql, {
    eventType: "session.preparing.v1",
    aggregateType: "play_session",
    aggregateId: playSessionId,
    idempotencyKey,
    payload: { playSessionId, toStatus: "preparing" },
  })

  assert.ok(first)
  assert.equal(second, null)

  const next = nextFailureState(1, "boom", new Date("2026-08-17T12:00:00.000Z"))
  assert.equal(next.status, "failed")
  assert.equal(next.availableAt, "2026-08-17T12:00:01.000Z")
})
