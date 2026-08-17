import db from "@/db/drizzle"
import { PlaySessionError } from "@/server/sessions/errors"
import {
  isPlaySessionAtOrPastStatus,
  nextLifecycleIntent,
} from "@/server/sessions/lifecycle-schedule.mjs"
import {
  getPlaySessionById,
  listSchedulablePlaySessions,
  transitionPlaySession,
  type PlaySessionRecord,
  type PlaySessionStatus,
} from "@/server/sessions/play-sessions"
import { writeAuditLog } from "@/server/tenancy/audit-log.mjs"
import { createServiceTenantContext } from "@/server/tenancy/context-factory"
import type { TenantContext } from "@/server/tenancy/types"
import {
  buildSessionLifecycleOutboxEvent,
  EVENT_TYPES,
  EVENT_VERSION,
} from "@/server/workers/events.mjs"
import { enqueueOutboxEvent } from "@/server/workers/outbox-repository"

type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export interface ScheduleLifecycleInput {
  session: PlaySessionRecord
  correlationId: string
  causationId?: string | null
  cause?: string
  now?: Date
}

function lifecycleContext(session: PlaySessionRecord, correlationId: string) {
  return createServiceTenantContext({
    tenantId: session.tenantId,
    actorId: "session-lifecycle",
    correlationId,
  })
}

export async function scheduleNextLifecycleIntent(
  input: ScheduleLifecycleInput,
  tx?: DbExecutor,
) {
  const now = input.now ?? new Date()
  const intent = nextLifecycleIntent(
    {
      status: input.session.status,
      scheduledStartAt: input.session.scheduledStartAt,
      scheduledEndAt: input.session.scheduledEndAt,
    },
    now,
  )

  if (!intent) {
    return null
  }

  return enqueueOutboxEvent(
    buildSessionLifecycleOutboxEvent({
      tenantId: input.session.tenantId,
      locationId: input.session.locationId,
      resourceId: input.session.resourceId,
      playSessionId: input.session.id,
      bookingId: input.session.bookingId,
      correlationId: input.correlationId,
      causationId: input.causationId ?? null,
      eventType: intent.eventType,
      toStatus: intent.toStatus,
      availableAt: intent.availableAt,
      cause: input.cause ?? "lifecycle_scheduler",
    }),
    tx,
  )
}

export async function reconcilePlaySessionLifecycle(now = new Date()) {
  const sessions = await listSchedulablePlaySessions()
  let scheduled = 0

  for (const session of sessions) {
    const event = await scheduleNextLifecycleIntent({
      session,
      correlationId: session.correlationId,
      cause: "lifecycle_reconciler",
      now,
    })

    if (event) {
      scheduled += 1
    }
  }

  return { scanned: sessions.length, scheduled }
}

export async function consumeSessionLifecycleEvent(row: {
  sessionId: string | null
  tenantId: string | null
  eventType: string
  correlationId: string
  id: string
  payload: Record<string, unknown>
}) {
  const sessionId = row.sessionId ?? String(row.payload.playSessionId ?? "")
  const tenantId = row.tenantId
  const toStatus = String(row.payload.toStatus ?? "") as PlaySessionStatus
  const cause = String(row.payload.cause ?? row.eventType)

  if (!sessionId || !tenantId || !toStatus) {
    throw new Error("Session lifecycle event is missing session identity.")
  }

  const context: TenantContext = lifecycleContext(
    {
      tenantId,
      id: sessionId,
    } as PlaySessionRecord,
    row.correlationId,
  )

  const result = await db.transaction(async (tx) => {
    const session = await getPlaySessionById(context, sessionId, tx)

    if (!session) {
      throw new PlaySessionError(
        "PLAY_SESSION_NOT_FOUND",
        `Play session ${sessionId} was not found for this tenant.`,
      )
    }

    if (isPlaySessionAtOrPastStatus(session.status, toStatus)) {
      return { kind: "already_applied" as const, session }
    }

    const updated = await transitionPlaySession(
      context,
      sessionId,
      toStatus,
      cause,
      tx,
    )

    await scheduleNextLifecycleIntent(
      {
        session: updated,
        correlationId: row.correlationId,
        causationId: row.id,
        cause: "lifecycle_consumer",
      },
      tx,
    )

    return { kind: "applied" as const, session: updated }
  })

  if (result.kind === "applied") {
    try {
      await writeAuditLog(context, {
        action: "play_session.transition",
        targetType: "play_session",
        targetId: sessionId,
        metadata: {
          toStatus,
          cause,
          eventType: row.eventType,
        },
      })
    } catch (error) {
      console.error("[SESSION LIFECYCLE] Failed to audit transition:", error)
    }
  }
}

export function createSessionLifecycleConsumers() {
  const consume = async (row: {
    sessionId: string | null
    tenantId: string | null
    eventType: string
    correlationId: string
    id: string
    payload: Record<string, unknown>
  }) => consumeSessionLifecycleEvent(row)

  return {
    [EVENT_TYPES.SESSION_PREPARING_V1]: { eventVersion: EVENT_VERSION, consume },
    [EVENT_TYPES.SESSION_STARTED_V1]: { eventVersion: EVENT_VERSION, consume },
    [EVENT_TYPES.SESSION_ENDING_V1]: { eventVersion: EVENT_VERSION, consume },
    [EVENT_TYPES.SESSION_COMPLETED_V1]: { eventVersion: EVENT_VERSION, consume },
    [EVENT_TYPES.SESSION_RESETTING_V1]: { eventVersion: EVENT_VERSION, consume },
  }
}
