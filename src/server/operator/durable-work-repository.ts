import { and, desc, eq, sql } from "drizzle-orm"

import db from "@/db/drizzle"
import { outboxEvents, paymentWebhookInbox } from "@/db/schema"
import type { TenantContext } from "@/server/tenancy/types"
import { countOutboxEventsByStatus } from "@/server/workers/outbox-repository"
import { countWebhookInboxByStatus } from "@/server/payments/webhook-inbox-repository"

export interface OperatorDeadLetterInboxRow {
  id: string
  eventType: string
  status: string
  attempts: number
  lastError: string | null
  receivedAt: string
  updatedAt: string
}

export interface OperatorDeadLetterOutboxRow {
  id: string
  eventType: string
  eventVersion: number
  status: string
  attempts: number
  lastError: string | null
  aggregateType: string
  aggregateId: string
  createdAt: string
  updatedAt: string
}

export interface OperatorDurableWorkOverview {
  inboxBacklog: Record<string, number>
  outboxBacklog: Record<string, number>
  deadLetterInbox: OperatorDeadLetterInboxRow[]
  deadLetterOutbox: OperatorDeadLetterOutboxRow[]
}

function tenantInboxCondition(context: TenantContext) {
  return and(
    eq(paymentWebhookInbox.status, "dead_letter"),
    eq(paymentWebhookInbox.tenantId, context.tenantId),
  )
}

function tenantOutboxCondition(context: TenantContext) {
  return and(
    eq(outboxEvents.status, "dead_letter"),
    eq(outboxEvents.tenantId, context.tenantId),
  )
}

export async function getOperatorDurableWorkOverview(
  context: TenantContext,
  limit = 20,
): Promise<OperatorDurableWorkOverview> {
  const [inboxBacklog, outboxBacklog, deadLetterInbox, deadLetterOutbox] =
    await Promise.all([
      countWebhookInboxByStatus(),
      countOutboxEventsByStatus(),
      db
        .select({
          id: paymentWebhookInbox.id,
          eventType: paymentWebhookInbox.eventType,
          status: paymentWebhookInbox.status,
          attempts: paymentWebhookInbox.attempts,
          lastError: paymentWebhookInbox.lastError,
          receivedAt: paymentWebhookInbox.receivedAt,
          updatedAt: paymentWebhookInbox.updatedAt,
        })
        .from(paymentWebhookInbox)
        .where(tenantInboxCondition(context))
        .orderBy(desc(paymentWebhookInbox.updatedAt))
        .limit(limit),
      db
        .select({
          id: outboxEvents.id,
          eventType: outboxEvents.eventType,
          eventVersion: outboxEvents.eventVersion,
          status: outboxEvents.status,
          attempts: outboxEvents.attempts,
          lastError: outboxEvents.lastError,
          aggregateType: outboxEvents.aggregateType,
          aggregateId: outboxEvents.aggregateId,
          createdAt: outboxEvents.createdAt,
          updatedAt: outboxEvents.updatedAt,
        })
        .from(outboxEvents)
        .where(tenantOutboxCondition(context))
        .orderBy(desc(outboxEvents.updatedAt))
        .limit(limit),
    ])

  return {
    inboxBacklog,
    outboxBacklog,
    deadLetterInbox: deadLetterInbox.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      status: row.status,
      attempts: row.attempts,
      lastError: row.lastError,
      receivedAt: row.receivedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    deadLetterOutbox: deadLetterOutbox.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      eventVersion: row.eventVersion,
      status: row.status,
      attempts: row.attempts,
      lastError: row.lastError,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
  }
}

export async function getDeadLetterInboxForTenant(
  context: TenantContext,
  inboxId: string,
) {
  const [row] = await db
    .select({ id: paymentWebhookInbox.id })
    .from(paymentWebhookInbox)
    .where(
      and(
        eq(paymentWebhookInbox.id, inboxId),
        eq(paymentWebhookInbox.tenantId, context.tenantId),
        eq(paymentWebhookInbox.status, "dead_letter"),
      ),
    )
    .limit(1)

  return row ?? null
}

export async function getDeadLetterOutboxForTenant(
  context: TenantContext,
  eventId: string,
) {
  const [row] = await db
    .select({ id: outboxEvents.id })
    .from(outboxEvents)
    .where(
      and(
        eq(outboxEvents.id, eventId),
        eq(outboxEvents.tenantId, context.tenantId),
        eq(outboxEvents.status, "dead_letter"),
      ),
    )
    .limit(1)

  return row ?? null
}

export async function countTenantDeadLetters(context: TenantContext) {
  const [inboxCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(paymentWebhookInbox)
    .where(tenantInboxCondition(context))

  const [outboxCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(outboxEvents)
    .where(tenantOutboxCondition(context))

  return {
    inbox: inboxCount?.count ?? 0,
    outbox: outboxCount?.count ?? 0,
  }
}
