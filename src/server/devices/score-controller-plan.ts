// Pure rules for moving score controllers between tables. No database here
// (node --test loads it directly); score-controllers.ts applies the result.

/** controllerId -> tableId it scores, or null for a spare at the venue. */
export type ControllerPlacement = Map<string, string | null>

export interface TableRequest {
  tableId: string
  /** The controller this table should use, or null for none. */
  controllerId: string | null
}

export class ControllerPlanError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ControllerPlanError"
  }
}

/**
 * Applies table requests in order to the current placement. Giving a table a
 * controller that's on another table moves it, leaving that table empty
 * unless a later request fills it (so a swap is two requests). Returns only
 * the controllers whose table changes.
 */
export function planControllerPlacement(
  current: ControllerPlacement,
  requests: TableRequest[],
  known: { tableIds: Set<string> },
): ControllerPlacement {
  const next: ControllerPlacement = new Map(current)

  for (const request of requests) {
    if (!known.tableIds.has(request.tableId)) {
      throw new ControllerPlanError("That table isn't at this venue.")
    }
    if (request.controllerId !== null && !next.has(request.controllerId)) {
      throw new ControllerPlanError("That controller isn't at this venue.")
    }

    for (const [controllerId, tableId] of next) {
      if (tableId === request.tableId) next.set(controllerId, null)
    }
    if (request.controllerId !== null) next.set(request.controllerId, request.tableId)
  }

  const changes: ControllerPlacement = new Map()
  for (const [controllerId, tableId] of next) {
    if ((current.get(controllerId) ?? null) !== tableId) changes.set(controllerId, tableId)
  }
  return changes
}

/** Short, readable name for a controller from its hardware id. */
export function controllerLabel(hardwareUid: string) {
  const tail = hardwareUid.split(/[-_]/).at(-1) ?? hardwareUid
  return `Controller ${tail.slice(-8).toUpperCase()}`
}

/** Online means a heartbeat in the last two minutes. */
export function isControllerOnline(lastHeartbeatAt: Date | null, now = Date.now()) {
  return Boolean(lastHeartbeatAt && now - lastHeartbeatAt.getTime() < 2 * 60_000)
}
