// Score controllers (the ESP32 buttons) are a shared pool, like cameras: set
// up once, then placed on any table at any venue and moved whenever needed.
// Moving only changes the assignment; the controller keeps its credentials
// and picks up its new table on the next button press, with no restart.

import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  deviceAssignments,
  devices,
  locations,
  playSessions,
  resourceCapabilities,
  resources,
} from "@/db/schema"
import { validateDeviceAssignmentPolicy } from "@/server/devices/policies.mjs"
import {
  controllerLabel,
  isControllerOnline,
  planControllerPlacement,
  type ControllerPlacement,
  type TableRequest,
} from "@/server/devices/score-controller-plan"
import { writeAuditLog } from "@/server/tenancy/audit-log.mjs"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import type { TenantContext } from "@/server/tenancy/types"

const CONTROLLER_TYPE = "esp32_controller" as const

export interface ScoreControllerSummary {
  id: string
  label: string
  hardwareUid: string
  online: boolean
  lastSeenAt: string | null
  firmwareVersion: string | null
  tableId: string | null
}

export interface ScoreControllerTable {
  id: string
  label: string
  active: boolean
  controllerId: string | null
  /** A session is running: moving its controller stops scoring there. */
  inSession: boolean
}

export interface ScoreControllerElsewhere {
  id: string
  label: string
  online: boolean
  venueId: string
  venueName: string
  tableName: string | null
}

export interface ScoreControllersView {
  venueId: string
  controllers: ScoreControllerSummary[]
  tables: ScoreControllerTable[]
  /** Controllers at other venues, which can be moved here. */
  elsewhere: ScoreControllerElsewhere[]
  /** Other venues a controller here can be sent to. */
  venues: { id: string; name: string }[]
}

async function openAssignments(tenantId: string, deviceIds: string[]) {
  if (deviceIds.length === 0) return []
  return db
    .select({
      id: deviceAssignments.id,
      deviceId: deviceAssignments.deviceId,
      resourceId: deviceAssignments.resourceId,
      role: deviceAssignments.role,
    })
    .from(deviceAssignments)
    .where(
      and(
        eq(deviceAssignments.tenantId, tenantId),
        inArray(deviceAssignments.deviceId, deviceIds),
        isNull(deviceAssignments.effectiveTo),
      ),
    )
}

async function listControllers(tenantId: string) {
  return db
    .select({
      id: devices.id,
      locationId: devices.locationId,
      hardwareUid: devices.hardwareUid,
      firmwareVersion: devices.firmwareVersion,
      lastHeartbeatAt: devices.lastHeartbeatAt,
      lastSeenAt: devices.lastSeenAt,
      capabilityCodes: devices.capabilityCodes,
    })
    .from(devices)
    .where(
      and(
        eq(devices.tenantId, tenantId),
        eq(devices.type, CONTROLLER_TYPE),
        ne(devices.status, "revoked"),
      ),
    )
    .orderBy(asc(devices.hardwareUid))
}

export async function getScoreControllersView(
  context: TenantContext,
  venueId: string,
): Promise<ScoreControllersView> {
  authorize(context, "venue.read")
  const tenantId = context.tenantId

  const [controllers, tables, venues] = await Promise.all([
    listControllers(tenantId),
    db
      .select({ id: resources.id, name: resources.name, isActive: resources.isActive })
      .from(resources)
      .where(and(eq(resources.tenantId, tenantId), eq(resources.locationId, venueId)))
      .orderBy(asc(resources.sortOrder), asc(resources.name)),
    db
      .select({ id: locations.id, name: locations.name })
      .from(locations)
      .where(eq(locations.tenantId, tenantId))
      .orderBy(asc(locations.name)),
  ])

  const assignments = await openAssignments(tenantId, controllers.map((controller) => controller.id))
  const tableOf = new Map(
    assignments
      .filter((assignment) => assignment.role === "score_input" && assignment.resourceId)
      .map((assignment) => [assignment.deviceId, assignment.resourceId as string]),
  )

  const sessions = tables.length
    ? await db
        .select({ resourceId: playSessions.resourceId })
        .from(playSessions)
        .where(
          and(
            eq(playSessions.tenantId, tenantId),
            inArray(playSessions.resourceId, tables.map((table) => table.id)),
            eq(playSessions.status, "active"),
          ),
        )
    : []
  const inSession = new Set(sessions.map((session) => session.resourceId))

  const allTableNames = new Map<string, string>()
  const otherTableIds = [...new Set([...tableOf.values()])].filter((id) => !tables.some((table) => table.id === id))
  if (otherTableIds.length) {
    const rows = await db
      .select({ id: resources.id, name: resources.name })
      .from(resources)
      .where(inArray(resources.id, otherTableIds))
    for (const row of rows) allTableNames.set(row.id, row.name)
  }
  const venueName = new Map(venues.map((venue) => [venue.id, venue.name]))
  const now = Date.now()

  const here = controllers.filter((controller) => controller.locationId === venueId)
  const controllerOnTable = new Map(here.map((controller) => [tableOf.get(controller.id) ?? "", controller.id]))

  return {
    venueId,
    controllers: here.map((controller) => ({
      id: controller.id,
      label: controllerLabel(controller.hardwareUid),
      hardwareUid: controller.hardwareUid,
      online: isControllerOnline(controller.lastHeartbeatAt, now),
      lastSeenAt: (controller.lastHeartbeatAt ?? controller.lastSeenAt)?.toISOString() ?? null,
      firmwareVersion: controller.firmwareVersion,
      tableId: tableOf.get(controller.id) ?? null,
    })),
    tables: tables.map((table) => ({
      id: table.id,
      label: table.name,
      active: table.isActive,
      controllerId: controllerOnTable.get(table.id) ?? null,
      inSession: inSession.has(table.id),
    })),
    elsewhere: controllers
      .filter((controller) => controller.locationId !== venueId)
      .map((controller) => {
        const tableId = tableOf.get(controller.id)
        return {
          id: controller.id,
          label: controllerLabel(controller.hardwareUid),
          online: isControllerOnline(controller.lastHeartbeatAt, now),
          venueId: controller.locationId,
          venueName: venueName.get(controller.locationId) ?? "Another venue",
          tableName: tableId ? (allTableNames.get(tableId) ?? null) : null,
        }
      }),
    venues: venues.filter((venue) => venue.id !== venueId),
  }
}

/** Ends a controller's open assignments; the controller becomes a spare. */
async function releaseController(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  tenantId: string,
  deviceId: string,
  at: Date,
) {
  await tx
    .update(deviceAssignments)
    .set({ effectiveTo: at, updatedAt: at })
    .where(
      and(
        eq(deviceAssignments.tenantId, tenantId),
        eq(deviceAssignments.deviceId, deviceId),
        isNull(deviceAssignments.effectiveTo),
      ),
    )
}

/**
 * Places the venue's controllers on tables. Requests are table → controller;
 * a controller taken from another table leaves that table empty unless the
 * same save gives it one (a swap). Everything applies in one transaction.
 */
export async function saveScoreControllerPlacement(
  context: TenantContext,
  venueId: string,
  requests: TableRequest[],
) {
  authorize(context, "venue.manage")
  const tenantId = context.tenantId

  const view = await getScoreControllersView(context, venueId)
  const current: ControllerPlacement = new Map(view.controllers.map((controller) => [controller.id, controller.tableId]))
  const changes = planControllerPlacement(current, requests, {
    tableIds: new Set(view.tables.map((table) => table.id)),
  })

  if (changes.size === 0) return { view, changed: 0 }

  // Tables must be able to score (resource capability "scoring").
  const targetTableIds = [...new Set([...changes.values()].filter((id): id is string => Boolean(id)))]
  const capabilityRows = targetTableIds.length
    ? await db
        .select({ resourceId: resourceCapabilities.resourceId, code: resourceCapabilities.code })
        .from(resourceCapabilities)
        .where(and(eq(resourceCapabilities.tenantId, tenantId), inArray(resourceCapabilities.resourceId, targetTableIds)))
    : []
  const controllers = await listControllers(tenantId)
  const deviceCaps = new Map(controllers.map((controller) => [controller.id, controller.capabilityCodes ?? []]))
  const tableName = new Map(view.tables.map((table) => [table.id, table.label]))

  for (const [controllerId, tableId] of changes) {
    if (!tableId) continue
    const policy = validateDeviceAssignmentPolicy({
      role: "score_input",
      deviceType: CONTROLLER_TYPE,
      deviceCapabilityCodes: deviceCaps.get(controllerId) ?? [],
      resourceId: tableId,
      resourceCapabilityCodes: capabilityRows.filter((row) => row.resourceId === tableId).map((row) => row.code),
    })
    if (!policy.ok) {
      throw new Error(
        policy.reason === "resource_capability_missing"
          ? `${tableName.get(tableId) ?? "That table"} isn't set up for scoring. Turn on scoring for it in the table settings.`
          : "That controller can't keep score.",
      )
    }
  }

  const now = new Date()
  await db.transaction(async (tx) => {
    // Free every moving controller first, so the one-controller-per-table
    // rule never sees two at once.
    for (const controllerId of changes.keys()) {
      await releaseController(tx, tenantId, controllerId, now)
    }
    for (const [controllerId, tableId] of changes) {
      if (!tableId) continue
      await tx.insert(deviceAssignments).values({
        tenantId,
        deviceId: controllerId,
        locationId: venueId,
        resourceId: tableId,
        role: "score_input",
        effectiveFrom: now,
        effectiveTo: null,
        config: {},
        configVersion: 1,
      })
    }
  })

  for (const [controllerId, tableId] of changes) {
    await writeAuditLog(context, {
      action: "device.score_controller.place",
      targetType: "device",
      targetId: controllerId,
      metadata: { venueId, fromTableId: current.get(controllerId) ?? null, toTableId: tableId },
    })
  }

  return { view: await getScoreControllersView(context, venueId), changed: changes.size }
}

/**
 * Sends a controller to another venue as a spare there (no table yet). Its
 * old table loses its controller, so that table stops being bookable until
 * another controller is placed on it.
 */
export async function moveScoreControllerToVenue(
  context: TenantContext,
  input: { deviceId: string; toVenueId: string },
) {
  authorize(context, "venue.manage")
  const tenantId = context.tenantId

  const [controller] = await db
    .select({ id: devices.id, locationId: devices.locationId, status: devices.status, type: devices.type })
    .from(devices)
    .where(and(eq(devices.tenantId, tenantId), eq(devices.id, input.deviceId)))
    .limit(1)

  if (!controller || controller.type !== CONTROLLER_TYPE) throw new Error("Controller not found.")
  if (controller.status === "revoked") throw new Error("This controller has been removed. Set it up again first.")

  const [venue] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.tenantId, tenantId), eq(locations.id, input.toVenueId)))
    .limit(1)
  if (!venue) throw new Error("Venue not found.")

  if (controller.locationId === input.toVenueId) return { moved: false }

  const now = new Date()
  await db.transaction(async (tx) => {
    await releaseController(tx, tenantId, controller.id, now)
    await tx
      .update(devices)
      .set({ locationId: input.toVenueId, updatedAt: now })
      .where(and(eq(devices.tenantId, tenantId), eq(devices.id, controller.id)))
  })

  await writeAuditLog(context, {
    action: "device.score_controller.move_venue",
    targetType: "device",
    targetId: controller.id,
    metadata: { fromVenueId: controller.locationId, toVenueId: input.toVenueId },
  })

  return { moved: true }
}
