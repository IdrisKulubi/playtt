import { and, eq, sql } from "drizzle-orm"

import db, { pool } from "@/db/drizzle"
import { paymentWebhookInbox } from "@/db/schema"

import { hashWebhookPayload } from "./webhook-inbox-utils.mjs"

export type PaymentWebhookInboxStatus =
  | "received"
  | "processing"
  | "processed"
  | "failed"
  | "dead_letter"

export interface PaymentWebhookInboxRecord {
  id: string
  tenantId: string | null
  provider: "paystack" | "mpesa_direct" | "manual"
  providerEventId: string | null
  payloadHash: string
  signature: string
  eventType: string
  rawPayload: string
  status: PaymentWebhookInboxStatus
  attempts: number
  lastError: string | null
  availableAt: string
  leaseExpiresAt: string | null
  leaseOwner: string | null
  receivedAt: string
  processedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PersistPaystackWebhookInput {
  rawBody: string
  signature: string
  eventType: string
  providerEventId: string | null
}

function mapInboxRow(
  row: typeof paymentWebhookInbox.$inferSelect,
): PaymentWebhookInboxRecord {
  return {
    id: row.id,
    tenantId: row.tenantId ?? null,
    provider: row.provider,
    providerEventId: row.providerEventId ?? null,
    payloadHash: row.payloadHash,
    signature: row.signature,
    eventType: row.eventType,
    rawPayload: row.rawPayload,
    status: row.status,
    attempts: row.attempts,
    lastError: row.lastError ?? null,
    availableAt: row.availableAt.toISOString(),
    leaseExpiresAt: row.leaseExpiresAt?.toISOString() ?? null,
    leaseOwner: row.leaseOwner ?? null,
    receivedAt: row.receivedAt.toISOString(),
    processedAt: row.processedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapPgInboxRow(row: Record<string, unknown>): PaymentWebhookInboxRecord {
  return {
    id: String(row.id),
    tenantId: row.tenant_id ? String(row.tenant_id) : null,
    provider: row.provider as PaymentWebhookInboxRecord["provider"],
    providerEventId: row.provider_event_id
      ? String(row.provider_event_id)
      : null,
    payloadHash: String(row.payload_hash),
    signature: String(row.signature),
    eventType: String(row.event_type),
    rawPayload: String(row.raw_payload),
    status: row.status as PaymentWebhookInboxStatus,
    attempts: Number(row.attempts),
    lastError: row.last_error ? String(row.last_error) : null,
    availableAt: new Date(String(row.available_at)).toISOString(),
    leaseExpiresAt: row.lease_expires_at
      ? new Date(String(row.lease_expires_at)).toISOString()
      : null,
    leaseOwner: row.lease_owner ? String(row.lease_owner) : null,
    receivedAt: new Date(String(row.received_at)).toISOString(),
    processedAt: row.processed_at
      ? new Date(String(row.processed_at)).toISOString()
      : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  }
}

export async function persistPaystackWebhook(
  input: PersistPaystackWebhookInput,
): Promise<PaymentWebhookInboxRecord> {
  const payloadHash = hashWebhookPayload(input.rawBody)

  const inserted = await db
    .insert(paymentWebhookInbox)
    .values({
      provider: "paystack",
      providerEventId: input.providerEventId,
      payloadHash,
      signature: input.signature,
      eventType: input.eventType,
      rawPayload: input.rawBody,
      status: "received",
    })
    .onConflictDoNothing()
    .returning()

  if (inserted.length > 0) {
    return mapInboxRow(inserted[0])
  }

  const [providerEventMatch] = input.providerEventId
    ? await db
        .select()
        .from(paymentWebhookInbox)
        .where(
          and(
            eq(paymentWebhookInbox.provider, "paystack"),
            eq(paymentWebhookInbox.providerEventId, input.providerEventId),
          ),
        )
        .limit(1)
    : []

  const [payloadMatch] = providerEventMatch
    ? []
    : await db
        .select()
        .from(paymentWebhookInbox)
        .where(
          and(
            eq(paymentWebhookInbox.provider, "paystack"),
            eq(paymentWebhookInbox.payloadHash, payloadHash),
          ),
        )
        .limit(1)

  const existing = providerEventMatch ?? payloadMatch

  if (!existing) {
    throw new Error("Could not persist Paystack webhook inbox row.")
  }

  return mapInboxRow(existing)
}

export async function markWebhookInboxProcessed(inboxId: string) {
  const [updated] = await db
    .update(paymentWebhookInbox)
    .set({
      status: "processed",
      processedAt: new Date(),
      lastError: null,
      leaseExpiresAt: null,
      leaseOwner: null,
    })
    .where(eq(paymentWebhookInbox.id, inboxId))
    .returning()

  if (!updated) {
    throw new Error("Webhook inbox row was not found.")
  }

  return mapInboxRow(updated)
}

export async function markWebhookInboxRetryOrDeadLetter(
  inboxId: string,
  input: {
    status: "failed" | "dead_letter"
    availableAt: Date
    lastError: string
  },
) {
  const [updated] = await db
    .update(paymentWebhookInbox)
    .set({
      status: input.status,
      availableAt: input.availableAt,
      lastError: input.lastError,
      leaseExpiresAt: null,
      leaseOwner: null,
    })
    .where(eq(paymentWebhookInbox.id, inboxId))
    .returning()

  if (!updated) {
    throw new Error("Webhook inbox row was not found.")
  }

  return mapInboxRow(updated)
}

export async function replayWebhookInbox(inboxId: string) {
  const [updated] = await db
    .update(paymentWebhookInbox)
    .set({
      status: "received",
      availableAt: new Date(),
      lastError: null,
      leaseExpiresAt: null,
      leaseOwner: null,
      processedAt: null,
    })
    .where(eq(paymentWebhookInbox.id, inboxId))
    .returning()

  return updated ? mapInboxRow(updated) : null
}

export async function countWebhookInboxByStatus(tenantId?: string) {
  const rows = await db
    .select({
      status: paymentWebhookInbox.status,
      count: sql<number>`count(*)::int`,
    })
    .from(paymentWebhookInbox)
    .where(tenantId ? eq(paymentWebhookInbox.tenantId, tenantId) : undefined)
    .groupBy(paymentWebhookInbox.status)

  return Object.fromEntries(rows.map((row) => [row.status, row.count])) as Record<
    string,
    number
  >
}

export async function claimWebhookInboxWork(input: {
  limit: number
  leaseMs: number
  owner: string
  claimSql: string
}): Promise<PaymentWebhookInboxRecord[]> {
  const client = await pool.connect()
  const leaseExpiresAt = new Date(Date.now() + input.leaseMs)

  try {
    await client.query("BEGIN")
    const selected = await client.query(input.claimSql, [input.limit])
    const claimed: PaymentWebhookInboxRecord[] = []

    for (const row of selected.rows) {
      const updated = await client.query(
        `
        UPDATE payment_webhook_inbox
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
        claimed.push(mapPgInboxRow(updated.rows[0]))
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
