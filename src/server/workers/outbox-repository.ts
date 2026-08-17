import { eq, sql } from "drizzle-orm"

import db, { pool } from "@/db/drizzle"
import { outboxEvents } from "@/db/schema"

type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export type OutboxEventStatus =
  | "pending"
  | "processing"
  | "processed"
  | "dead_letter"

export interface OutboxEventRecord {
  id: string
  tenantId: string | null
  venueId: string | null
  resourceId: string | null
  sessionId: string | null
  aggregateType: string
  aggregateId: string
  eventType: string
  eventVersion: number
  correlationId: string
  causationId: string | null
  payload: Record<string, unknown>
  idempotencyKey: string
  status: OutboxEventStatus
  availableAt: string
  leaseExpiresAt: string | null
  leaseOwner: string | null
  attempts: number
  lastError: string | null
  processedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface EnqueueOutboxEventInput {
  tenantId?: string | null
  venueId?: string | null
  resourceId?: string | null
  sessionId?: string | null
  aggregateType: string
  aggregateId: string
  eventType: string
  eventVersion?: number
  correlationId: string
  causationId?: string | null
  payload: Record<string, unknown>
  idempotencyKey: string
}

function mapOutboxRow(
  row: typeof outboxEvents.$inferSelect,
): OutboxEventRecord {
  return {
    id: row.id,
    tenantId: row.tenantId ?? null,
    venueId: row.venueId ?? null,
    resourceId: row.resourceId ?? null,
    sessionId: row.sessionId ?? null,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    eventType: row.eventType,
    eventVersion: row.eventVersion,
    correlationId: row.correlationId,
    causationId: row.causationId ?? null,
    payload: row.payload,
    idempotencyKey: row.idempotencyKey,
    status: row.status,
    availableAt: row.availableAt.toISOString(),
    leaseExpiresAt: row.leaseExpiresAt?.toISOString() ?? null,
    leaseOwner: row.leaseOwner ?? null,
    attempts: row.attempts,
    lastError: row.lastError ?? null,
    processedAt: row.processedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapPgOutboxRow(row: Record<string, unknown>): OutboxEventRecord {
  return {
    id: String(row.id),
    tenantId: row.tenant_id ? String(row.tenant_id) : null,
    venueId: row.venue_id ? String(row.venue_id) : null,
    resourceId: row.resource_id ? String(row.resource_id) : null,
    sessionId: row.session_id ? String(row.session_id) : null,
    aggregateType: String(row.aggregate_type),
    aggregateId: String(row.aggregate_id),
    eventType: String(row.event_type),
    eventVersion: Number(row.event_version),
    correlationId: String(row.correlation_id),
    causationId: row.causation_id ? String(row.causation_id) : null,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    idempotencyKey: String(row.idempotency_key),
    status: row.status as OutboxEventStatus,
    availableAt: new Date(String(row.available_at)).toISOString(),
    leaseExpiresAt: row.lease_expires_at
      ? new Date(String(row.lease_expires_at)).toISOString()
      : null,
    leaseOwner: row.lease_owner ? String(row.lease_owner) : null,
    attempts: Number(row.attempts),
    lastError: row.last_error ? String(row.last_error) : null,
    processedAt: row.processed_at
      ? new Date(String(row.processed_at)).toISOString()
      : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  }
}

export async function enqueueOutboxEvent(
  input: EnqueueOutboxEventInput,
  tx?: DbExecutor,
): Promise<OutboxEventRecord> {
  const executor = tx ?? db
  const inserted = await executor
    .insert(outboxEvents)
    .values({
      tenantId: input.tenantId ?? null,
      venueId: input.venueId ?? null,
      resourceId: input.resourceId ?? null,
      sessionId: input.sessionId ?? null,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      eventVersion: input.eventVersion ?? 1,
      correlationId: input.correlationId,
      causationId: input.causationId ?? null,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      status: "pending",
    })
    .onConflictDoNothing({
      target: [outboxEvents.idempotencyKey],
    })
    .returning()

  if (inserted.length > 0) {
    return mapOutboxRow(inserted[0])
  }

  const [existing] = await executor
    .select()
    .from(outboxEvents)
    .where(eq(outboxEvents.idempotencyKey, input.idempotencyKey))
    .limit(1)

  if (!existing) {
    throw new Error("Could not persist outbox event.")
  }

  return mapOutboxRow(existing)
}

export async function markOutboxProcessed(eventId: string) {
  const [updated] = await db
    .update(outboxEvents)
    .set({
      status: "processed",
      processedAt: new Date(),
      lastError: null,
      leaseExpiresAt: null,
      leaseOwner: null,
    })
    .where(eq(outboxEvents.id, eventId))
    .returning()

  if (!updated) {
    throw new Error("Outbox event was not found.")
  }

  return mapOutboxRow(updated)
}

export async function markOutboxRetryOrDeadLetter(
  eventId: string,
  input: {
    status: "pending" | "dead_letter"
    availableAt: Date
    lastError: string
  },
) {
  const [updated] = await db
    .update(outboxEvents)
    .set({
      status: input.status,
      availableAt: input.availableAt,
      lastError: input.lastError,
      leaseExpiresAt: null,
      leaseOwner: null,
    })
    .where(eq(outboxEvents.id, eventId))
    .returning()

  if (!updated) {
    throw new Error("Outbox event was not found.")
  }

  return mapOutboxRow(updated)
}

export async function replayOutboxEvent(eventId: string) {
  const [updated] = await db
    .update(outboxEvents)
    .set({
      status: "pending",
      availableAt: new Date(),
      lastError: null,
      leaseExpiresAt: null,
      leaseOwner: null,
      processedAt: null,
    })
    .where(eq(outboxEvents.id, eventId))
    .returning()

  return updated ? mapOutboxRow(updated) : null
}

export async function countOutboxEventsByStatus() {
  const rows = await db
    .select({
      status: outboxEvents.status,
      count: sql<number>`count(*)::int`,
    })
    .from(outboxEvents)
    .groupBy(outboxEvents.status)

  return Object.fromEntries(rows.map((row) => [row.status, row.count])) as Record<
    string,
    number
  >
}

export async function claimOutboxWork(input: {
  limit: number
  leaseMs: number
  owner: string
  eventTypes: string[]
  claimSql: string
}): Promise<OutboxEventRecord[]> {
  const client = await pool.connect()
  const leaseExpiresAt = new Date(Date.now() + input.leaseMs)

  try {
    await client.query("BEGIN")
    const selected = await client.query(input.claimSql, [
      input.limit,
      input.eventTypes,
    ])
    const claimed: OutboxEventRecord[] = []

    for (const row of selected.rows) {
      const updated = await client.query(
        `
        UPDATE outbox_events
        SET status = 'processing',
            lease_owner = $2,
            lease_expires_at = $3,
            attempts = attempts + 1,
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [row.id, input.owner, leaseExpiresAt],
      )

      if (updated.rows[0]) {
        claimed.push(mapPgOutboxRow(updated.rows[0]))
      }
    }

    await client.query("COMMIT")
    return claimed
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
