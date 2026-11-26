// A table can only be booked when it can deliver the full PlayTT session:
// score buttons to keep score and a camera to record replays. Without either,
// someone would pay for a table where Replay or the scoreboard can't work.

import { and, eq, exists, inArray, isNull, ne, sql } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  deviceAssignments,
  devices,
  replayCameraSources,
  replaySourceRoutes,
  resources,
} from "@/db/schema"

/** An open score-input assignment on a device that isn't revoked. */
function scoreInputFor(resourceId: typeof resources.id | string) {
  return db
    .select({ one: sql`1` })
    .from(deviceAssignments)
    .innerJoin(devices, eq(devices.id, deviceAssignments.deviceId))
    .where(
      and(
        eq(deviceAssignments.resourceId, resourceId),
        eq(deviceAssignments.role, "score_input"),
        isNull(deviceAssignments.effectiveTo),
        ne(devices.status, "revoked"),
      ),
    )
}

/** An enabled replay route to a camera that hasn't been retired. */
function cameraFor(resourceId: typeof resources.id | string) {
  return db
    .select({ one: sql`1` })
    .from(replaySourceRoutes)
    .innerJoin(replayCameraSources, eq(replayCameraSources.id, replaySourceRoutes.cameraSourceId))
    .where(
      and(
        eq(replaySourceRoutes.resourceId, resourceId),
        eq(replaySourceRoutes.isEnabled, true),
        isNull(replaySourceRoutes.retiredAt),
        isNull(replayCameraSources.retiredAt),
      ),
    )
}

/**
 * SQL condition for "this `resources` row is ready to book". Add it next to
 * `resources.isActive` wherever a table is offered or booked.
 */
export function bookableTableCondition() {
  return and(exists(scoreInputFor(resources.id)), exists(cameraFor(resources.id)))
}

export interface TableReadiness {
  hasScoreInput: boolean
  hasCamera: boolean
}

/** Why each table is or isn't bookable, for admin screens. */
export async function getTableReadiness(
  tenantId: string,
  resourceIds: string[],
): Promise<Map<string, TableReadiness>> {
  if (resourceIds.length === 0) return new Map()

  const rows = await db
    .select({
      id: resources.id,
      hasScoreInput: sql<boolean>`${exists(scoreInputFor(resources.id))}`,
      hasCamera: sql<boolean>`${exists(cameraFor(resources.id))}`,
    })
    .from(resources)
    .where(and(eq(resources.tenantId, tenantId), inArray(resources.id, resourceIds)))

  return new Map(
    rows.map((row) => [row.id, { hasScoreInput: Boolean(row.hasScoreInput), hasCamera: Boolean(row.hasCamera) }]),
  )
}
