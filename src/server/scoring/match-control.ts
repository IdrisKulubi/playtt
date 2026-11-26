import { randomUUID } from "node:crypto"

import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { playSessions, resources, scoreSnapshots } from "@/db/schema"
import {
  getSportRulesAdapter,
  resolveRulesetFromSnapshot,
  type ScoreState,
} from "@/server/scoring/adapter"
import {
  parseMatchSetup,
  stateForEndedMatch,
  stateForStartedMatch,
  type MatchSetupInput,
} from "@/server/scoring/match-setup"
import { enqueueOutboxEvent } from "@/server/workers/outbox-repository"

export class MatchControlError extends Error {
  constructor(
    readonly code: "RESOURCE_NOT_FOUND" | "SESSION_NOT_ACTIVE" | "INVALID_SETUP",
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "MatchControlError"
  }
}

export interface MatchControlResult {
  snapshotVersion: number
  state: ScoreState
}

async function activeSessionForResource(resourceId: string) {
  const [resource] = await db
    .select({ id: resources.id, tenantId: resources.tenantId })
    .from(resources)
    .where(eq(resources.id, resourceId))
    .limit(1)

  if (!resource) {
    throw new MatchControlError("RESOURCE_NOT_FOUND", "We could not find that table.", 404)
  }

  const [session] = await db
    .select()
    .from(playSessions)
    .where(
      and(
        eq(playSessions.tenantId, resource.tenantId),
        eq(playSessions.resourceId, resource.id),
        eq(playSessions.status, "active"),
      ),
    )
    .limit(1)

  if (!session) {
    throw new MatchControlError(
      "SESSION_NOT_ACTIVE",
      "There is no active session on this table.",
      409,
    )
  }

  return session
}

/**
 * Replaces the table's score state and tells every screen, through the same
 * `score.updated.v1` event an ESP32 point produces. The device sequence
 * columns are left alone, so the buttons keep scoring without a re-sync.
 */
async function replaceScoreState(
  resourceId: string,
  buildState: (initial: ScoreState) => ScoreState,
  reason: "match_started" | "match_ended",
): Promise<MatchControlResult> {
  const session = await activeSessionForResource(resourceId)
  const ruleset = resolveRulesetFromSnapshot(
    session.configurationSnapshot as Record<string, unknown>,
  )
  const nextState = buildState(getSportRulesAdapter(ruleset).initialState({ ruleset }))

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(scoreSnapshots)
      .where(eq(scoreSnapshots.playSessionId, session.id))
      .for("update")
      .limit(1)

    const nextVersion = (existing?.version ?? 0) + 1
    const state = nextState as unknown as Record<string, unknown>

    const [snapshot] = existing
      ? await tx
          .update(scoreSnapshots)
          .set({ version: nextVersion, state, updatedAt: new Date() })
          .where(eq(scoreSnapshots.id, existing.id))
          .returning()
      : await tx
          .insert(scoreSnapshots)
          .values({
            tenantId: session.tenantId,
            playSessionId: session.id,
            resourceId: session.resourceId,
            locationId: session.locationId,
            version: nextVersion,
            state,
          })
          .returning()

    const eventId = randomUUID()
    await enqueueOutboxEvent(
      {
        tenantId: session.tenantId,
        venueId: session.locationId,
        resourceId: session.resourceId,
        sessionId: session.id,
        aggregateType: "score_snapshot",
        aggregateId: snapshot.id,
        eventType: "score.updated.v1",
        eventVersion: 1,
        correlationId: `${reason}:${eventId}`,
        payload: {
          playSessionId: session.id,
          snapshotVersion: nextVersion,
          state: nextState,
          eventId,
        },
        idempotencyKey: `score.updated.v1:${reason}:${snapshot.id}:${nextVersion}`,
      },
      tx,
    )

    return { snapshotVersion: nextVersion, state: nextState }
  })
}

export async function startTableMatch(resourceId: string, input: MatchSetupInput) {
  let setup
  try {
    setup = parseMatchSetup(input)
  } catch (error) {
    throw new MatchControlError(
      "INVALID_SETUP",
      error instanceof Error ? error.message : "Check the match details.",
      400,
    )
  }

  return replaceScoreState(resourceId, (initial) => stateForStartedMatch(initial, setup), "match_started")
}

export async function endTableMatch(resourceId: string) {
  return replaceScoreState(resourceId, stateForEndedMatch, "match_ended")
}
