import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { matches, playSessions, scoreEvents, scoreSnapshots } from "@/db/schema"
import type { scoreEventKindEnum, scoreSideEnum } from "@/db/schema"
import {
  getCurrentAssignmentForDevice,
  type DeviceRecord,
} from "@/server/devices/devices"
import { DeviceError } from "@/server/devices/errors"
import {
  getSportRulesAdapter,
  resolveRulesetFromSnapshot,
  SportRulesError,
  type ScoreEventKind,
  type ScoreSide,
  type ScoreState,
} from "@/server/scoring/adapter"
import { enqueueOutboxEvent } from "@/server/workers/outbox-repository"

export type ScoreEventKindValue =
  (typeof scoreEventKindEnum.enumValues)[number]
export type ScoreSideValue = (typeof scoreSideEnum.enumValues)[number]

export interface IngestScoreEventInput {
  tenantId: string
  device: DeviceRecord
  bootId: string
  sequence: number
  kind: ScoreEventKindValue
  side: ScoreSideValue
  delta?: number
  correlationId: string
}

export interface IngestScoreEventResult {
  snapshotVersion: number
  state: ScoreState
  duplicate: boolean
  eventId: string
}

function mapSnapshotState(state: Record<string, unknown>): ScoreState {
  return state as unknown as ScoreState
}

function serializeSnapshotState(state: ScoreState): Record<string, unknown> {
  return state as unknown as Record<string, unknown>
}

function assertExpectedSequence(
  snapshot: typeof scoreSnapshots.$inferSelect | null,
  bootId: string,
  sequence: number,
) {
  if (!snapshot?.lastBootId || snapshot.lastBootId !== bootId) {
    if (sequence !== 1) {
      throw new DeviceError(
        "SEQUENCE_GAP",
        "Score sequence must start at 1 for a new boot.",
        409,
      )
    }
    return
  }

  const expected = (snapshot.lastSequence ?? 0) + 1
  if (sequence !== expected) {
    throw new DeviceError(
      "SEQUENCE_GAP",
      `Expected score sequence ${expected}, received ${sequence}.`,
      409,
    )
  }
}

async function getActivePlaySessionForResource(
  tenantId: string,
  resourceId: string,
) {
  const [session] = await db
    .select()
    .from(playSessions)
    .where(
      and(
        eq(playSessions.tenantId, tenantId),
        eq(playSessions.resourceId, resourceId),
        eq(playSessions.status, "active"),
      ),
    )
    .limit(1)

  return session ?? null
}

async function projectMatchScore(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: {
    tenantId: string
    bookingId: string
    state: ScoreState
  },
) {
  const matchStatus =
    input.state.matchStatus === "completed"
      ? "completed"
      : input.state.matchStatus === "not_started"
        ? "not_started"
        : "in_progress"

  const [existing] = await tx
    .select({ startedAt: matches.startedAt })
    .from(matches)
    .where(
      and(
        eq(matches.tenantId, input.tenantId),
        eq(matches.bookingId, input.bookingId),
      ),
    )
    .limit(1)

  if (!existing) {
    return
  }

  await tx
    .update(matches)
    .set({
      scorePlayerA: input.state.gamesA,
      scorePlayerB: input.state.gamesB,
      status: matchStatus,
      startedAt:
        existing.startedAt ??
        (matchStatus === "in_progress" || matchStatus === "completed"
          ? new Date()
          : null),
      endedAt: matchStatus === "completed" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(matches.tenantId, input.tenantId),
        eq(matches.bookingId, input.bookingId),
      ),
    )
}

export async function ingestScoreEvent(
  input: IngestScoreEventInput,
): Promise<IngestScoreEventResult> {
  if (input.device.status === "revoked") {
    throw new DeviceError("DEVICE_REVOKED", "Device has been revoked.", 403)
  }

  const assignment = await getCurrentAssignmentForDevice(
    input.tenantId,
    input.device.id,
  )

  if (!assignment || assignment.role !== "score_input" || !assignment.resourceId) {
    throw new DeviceError(
      "SCORE_FORBIDDEN",
      "Device is not assigned as score input for a resource.",
      403,
    )
  }

  const playSession = await getActivePlaySessionForResource(
    input.tenantId,
    assignment.resourceId,
  )

  if (!playSession) {
    throw new DeviceError(
      "SESSION_INACTIVE",
      "No active play session exists for this resource.",
      403,
    )
  }

  if (playSession.resourceId !== assignment.resourceId) {
    throw new DeviceError(
      "SCORE_FORBIDDEN",
      "Device assignment does not match the active session resource.",
      403,
    )
  }

  const ruleset = resolveRulesetFromSnapshot(
    playSession.configurationSnapshot as Record<string, unknown>,
  )

  let adapter
  try {
    adapter = getSportRulesAdapter(ruleset)
  } catch (error) {
    if (error instanceof SportRulesError) {
      throw new DeviceError(
        "RULESET_UNSUPPORTED",
        error.message,
        400,
      )
    }
    throw error
  }

  return db.transaction(async (tx) => {
    let [snapshot] = await tx
      .select()
      .from(scoreSnapshots)
      .where(eq(scoreSnapshots.playSessionId, playSession.id))
      .for("update")
      .limit(1)

    if (!snapshot) {
      const initialState = adapter.initialState({ ruleset })
      ;[snapshot] = await tx
        .insert(scoreSnapshots)
        .values({
          tenantId: input.tenantId,
          playSessionId: playSession.id,
          resourceId: playSession.resourceId,
          locationId: playSession.locationId,
          version: 0,
          state: serializeSnapshotState(initialState),
        })
        .returning()
    }

    const existingDuplicate = await tx
      .select()
      .from(scoreEvents)
      .where(
        and(
          eq(scoreEvents.deviceId, input.device.id),
          eq(scoreEvents.bootId, input.bootId),
          eq(scoreEvents.sequence, input.sequence),
        ),
      )
      .limit(1)

    if (existingDuplicate[0]) {
      return {
        snapshotVersion: snapshot.version,
        state: mapSnapshotState(snapshot.state as Record<string, unknown>),
        duplicate: true,
        eventId: existingDuplicate[0].id,
      }
    }

    assertExpectedSequence(snapshot, input.bootId, input.sequence)

    const delta = input.delta ?? (input.kind === "correction" ? -1 : 1)

    let nextState: ScoreState
    try {
      nextState = adapter.applyEvent(
        mapSnapshotState(snapshot.state as Record<string, unknown>),
        {
          kind: input.kind as ScoreEventKind,
          side: input.side as ScoreSide,
          delta,
        },
      )
    } catch (error) {
      if (error instanceof SportRulesError) {
        throw new DeviceError("SCORE_FORBIDDEN", error.message, 409)
      }
      throw error
    }

    const [event] = await tx
      .insert(scoreEvents)
      .values({
        tenantId: input.tenantId,
        deviceId: input.device.id,
        playSessionId: playSession.id,
        assignmentId: assignment.id,
        resourceId: playSession.resourceId,
        locationId: playSession.locationId,
        bootId: input.bootId,
        sequence: input.sequence,
        kind: input.kind,
        side: input.side,
        delta,
        ruleset,
        correlationId: input.correlationId,
      })
      .returning()

    const nextVersion = snapshot.version + 1

    const [updatedSnapshot] = await tx
      .update(scoreSnapshots)
      .set({
        version: nextVersion,
        state: serializeSnapshotState(nextState),
        lastEventId: event.id,
        lastSequence: input.sequence,
        lastBootId: input.bootId,
        updatedAt: new Date(),
      })
      .where(eq(scoreSnapshots.id, snapshot.id))
      .returning()

    await enqueueOutboxEvent(
      {
        tenantId: input.tenantId,
        venueId: playSession.locationId,
        resourceId: playSession.resourceId,
        sessionId: playSession.id,
        aggregateType: "score_snapshot",
        aggregateId: updatedSnapshot.id,
        eventType: "score.updated.v1",
        eventVersion: 1,
        correlationId: input.correlationId,
        causationId: event.id,
        payload: {
          playSessionId: playSession.id,
          snapshotVersion: nextVersion,
          state: nextState,
          eventId: event.id,
        },
        idempotencyKey: `score.updated.v1:${event.id}`,
      },
      tx,
    )

    await projectMatchScore(tx, {
      tenantId: input.tenantId,
      bookingId: playSession.bookingId,
      state: nextState,
    })

    return {
      snapshotVersion: updatedSnapshot.version,
      state: nextState,
      duplicate: false,
      eventId: event.id,
    }
  })
}
