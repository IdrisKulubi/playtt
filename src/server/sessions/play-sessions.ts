import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  accessCredentials,
  bookings,
  matches,
  playSessions,
  replays,
  resources,
  sessionEvents,
  sessionParticipants,
} from "@/db/schema"
import type { playSessionStatusEnum } from "@/db/schema"
import { PlaySessionError } from "@/server/sessions/errors"
import {
  canTransitionPlaySession,
  initialPlaySessionStatusForBooking,
  playSessionTimestampUpdatesForTransition,
  shouldCreatePlaySessionForBooking,
} from "@/server/sessions/state-machine.mjs"
import type { TenantContext } from "@/server/tenancy/types"

type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export type PlaySessionStatus =
  (typeof playSessionStatusEnum.enumValues)[number]

export interface PlaySessionRecord {
  id: string
  tenantId: string
  bookingId: string
  locationId: string
  resourceId: string
  status: PlaySessionStatus
  correlationId: string
  scheduledStartAt: string
  scheduledEndAt: string
  preparedAt: string | null
  startedAt: string | null
  endedAt: string | null
  completedAt: string | null
  resetAt: string | null
  configurationSnapshot: Record<string, unknown>
  configurationVersion: number
  createdAt: string
  updatedAt: string
}

export interface EnsurePlaySessionBookingInput {
  id: string
  tenantId: string
  locationId: string
  resourceId: string
  userId: string
  status: string
  paymentStatus: string
  startTime: Date
  endTime: Date
  pricingRuleSnapshot?: Record<string, unknown> | null
  totalAmount?: string
  currency?: string
}

function mapPlaySession(
  row: typeof playSessions.$inferSelect,
): PlaySessionRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    bookingId: row.bookingId,
    locationId: row.locationId,
    resourceId: row.resourceId,
    status: row.status,
    correlationId: row.correlationId,
    scheduledStartAt: row.scheduledStartAt.toISOString(),
    scheduledEndAt: row.scheduledEndAt.toISOString(),
    preparedAt: row.preparedAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    resetAt: row.resetAt?.toISOString() ?? null,
    configurationSnapshot: row.configurationSnapshot,
    configurationVersion: row.configurationVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function buildConfigurationSnapshot(
  booking: EnsurePlaySessionBookingInput,
  tx?: DbExecutor,
) {
  const executor = tx ?? db
  const [resource] = await executor
    .select({
      ruleset: resources.ruleset,
      configuration: resources.configuration,
      metadata: resources.metadata,
      name: resources.name,
      code: resources.code,
    })
    .from(resources)
    .where(
      and(
        eq(resources.tenantId, booking.tenantId),
        eq(resources.id, booking.resourceId),
      ),
    )
    .limit(1)

  return {
    resource: resource ?? null,
    booking: {
      pricingRuleSnapshot: booking.pricingRuleSnapshot ?? null,
      totalAmount: booking.totalAmount ?? null,
      currency: booking.currency ?? null,
    },
  }
}

async function linkChildRowsToPlaySession(
  tenantId: string,
  bookingId: string,
  playSessionId: string,
  tx?: DbExecutor,
) {
  const executor = tx ?? db
  await Promise.all([
    executor
      .update(matches)
      .set({ playSessionId })
      .where(
        and(
          eq(matches.tenantId, tenantId),
          eq(matches.bookingId, bookingId),
        ),
      ),
    executor
      .update(accessCredentials)
      .set({ playSessionId })
      .where(
        and(
          eq(accessCredentials.tenantId, tenantId),
          eq(accessCredentials.bookingId, bookingId),
        ),
      ),
    executor
      .update(sessionEvents)
      .set({ playSessionId })
      .where(
        and(
          eq(sessionEvents.tenantId, tenantId),
          eq(sessionEvents.bookingId, bookingId),
        ),
      ),
    executor
      .update(replays)
      .set({ playSessionId })
      .where(
        and(eq(replays.tenantId, tenantId), eq(replays.bookingId, bookingId)),
      ),
  ])
}

export async function getPlaySessionByBookingId(
  context: TenantContext,
  bookingId: string,
  tx?: DbExecutor,
): Promise<PlaySessionRecord | null> {
  const executor = tx ?? db
  const [row] = await executor
    .select()
    .from(playSessions)
    .where(
      and(
        eq(playSessions.tenantId, context.tenantId),
        eq(playSessions.bookingId, bookingId),
      ),
    )
    .limit(1)

  return row ? mapPlaySession(row) : null
}

export async function ensurePlaySessionForBooking(
  context: TenantContext,
  booking: EnsurePlaySessionBookingInput,
  tx?: DbExecutor,
): Promise<PlaySessionRecord | null> {
  const executor = tx ?? db
  if (booking.tenantId !== context.tenantId) {
    return null
  }

  if (!shouldCreatePlaySessionForBooking(booking)) {
    return null
  }

  const initialStatus = initialPlaySessionStatusForBooking(booking.status)

  if (!initialStatus) {
    return null
  }

  const existing = await getPlaySessionByBookingId(context, booking.id, tx)

  if (existing) {
    await linkChildRowsToPlaySession(
      context.tenantId,
      booking.id,
      existing.id,
      tx,
    )
    return existing
  }

  const configurationSnapshot = await buildConfigurationSnapshot(booking, tx)

  const [created] = await executor
    .insert(playSessions)
    .values({
      tenantId: context.tenantId,
      bookingId: booking.id,
      locationId: booking.locationId,
      resourceId: booking.resourceId,
      status: initialStatus,
      correlationId: context.correlationId,
      scheduledStartAt: booking.startTime,
      scheduledEndAt: booking.endTime,
      configurationSnapshot,
      configurationVersion: 1,
    })
    .onConflictDoNothing({
      target: playSessions.bookingId,
    })
    .returning()

  const session =
    created !== undefined
      ? mapPlaySession(created)
      : await getPlaySessionByBookingId(context, booking.id, tx)

  if (!session) {
    throw new PlaySessionError(
      "PLAY_SESSION_ENSURE_FAILED",
      `Failed to ensure play session for booking ${booking.id}.`,
    )
  }

  await executor
    .insert(sessionParticipants)
    .values({
      tenantId: context.tenantId,
      playSessionId: session.id,
      userId: booking.userId,
      role: "owner",
    })
    .onConflictDoNothing({
      target: [sessionParticipants.playSessionId, sessionParticipants.userId],
    })

  await linkChildRowsToPlaySession(
    context.tenantId,
    booking.id,
    session.id,
    tx,
  )

  return session
}

export async function transitionPlaySession(
  context: TenantContext,
  sessionId: string,
  toStatus: PlaySessionStatus,
  cause: string,
): Promise<PlaySessionRecord> {
  const [current] = await db
    .select()
    .from(playSessions)
    .where(
      and(
        eq(playSessions.tenantId, context.tenantId),
        eq(playSessions.id, sessionId),
      ),
    )
    .limit(1)

  if (!current) {
    throw new PlaySessionError(
      "PLAY_SESSION_NOT_FOUND",
      `Play session ${sessionId} was not found for this tenant.`,
    )
  }

  const transition = canTransitionPlaySession(current.status, toStatus)

  if (!transition.ok) {
    throw new PlaySessionError(
      transition.code ?? "ILLEGAL_SESSION_TRANSITION",
      `Cannot transition play session ${sessionId} from ${current.status} to ${toStatus}.`,
    )
  }

  if (transition.idempotent) {
    return mapPlaySession(current)
  }

  const now = new Date()
  const timestampUpdates = playSessionTimestampUpdatesForTransition(
    toStatus,
    now,
  )

  const [updated] = await db
    .update(playSessions)
    .set({
      status: toStatus,
      ...timestampUpdates,
    })
    .where(
      and(
        eq(playSessions.tenantId, context.tenantId),
        eq(playSessions.id, sessionId),
        eq(playSessions.status, current.status),
      ),
    )
    .returning()

  if (!updated) {
    const [latest] = await db
      .select()
      .from(playSessions)
      .where(
        and(
          eq(playSessions.tenantId, context.tenantId),
          eq(playSessions.id, sessionId),
        ),
      )
      .limit(1)

    if (latest && latest.status === toStatus) {
      return mapPlaySession(latest)
    }

    throw new PlaySessionError(
      "PLAY_SESSION_STATE_CHANGED",
      `Play session ${sessionId} changed before transition to ${toStatus}.`,
    )
  }

  return mapPlaySession(updated)
}

export async function getBookingForPlaySession(
  context: TenantContext,
  bookingId: string,
) {
  const [row] = await db
    .select({
      id: bookings.id,
      tenantId: bookings.tenantId,
      locationId: bookings.locationId,
      resourceId: bookings.resourceId,
      userId: bookings.userId,
      status: bookings.status,
      paymentStatus: bookings.paymentStatus,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      pricingRuleSnapshot: bookings.pricingRuleSnapshot,
      totalAmount: bookings.totalAmount,
      currency: bookings.currency,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.tenantId, context.tenantId),
        eq(bookings.id, bookingId),
      ),
    )
    .limit(1)

  return row ?? null
}
