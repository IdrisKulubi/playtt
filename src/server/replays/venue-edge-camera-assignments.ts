// Table ↔ camera assignments for a VenueEdge installation, editable from the
// PlayTT admin after the venue PC has been set up. Saving publishes a new
// Config v2 revision; the venue PC adopts the new mapping without re-running
// local setup. Camera stills are uploaded by the venue PC straight to R2.
import { and, eq, isNull } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  replayCameraSources,
  replayRecorders,
  replaySourcePolicies,
  replaySourceRoutes,
  resources,
  venueEdgeInstallations,
  venueEdgeSecretRefs,
} from "@/db/schema"
import { DeviceError } from "@/server/devices/errors"
import { createR2MediaStore } from "@/server/media/r2-adapter"
import type { MediaStore } from "@/server/media/types"
import { VENUE_EDGE_AUDIT_ACTIONS } from "@/server/replays/venue-edge-audit-actions"
import {
  CameraAssignmentValidationError,
  cameraStillObjectKey,
  normaliseCameraAssignments,
  type CameraAssignmentInput,
} from "@/server/replays/venue-edge-camera-assignment-rules"
import { publishEdgeConfigV2Revision } from "@/server/replays/edge-config-v2-publication"
import { buildTopologySnapshotForLocation } from "@/server/replays/venue-edge-topology"
import { writeAuditLog } from "@/server/tenancy/audit-log-write"
import type { TenantContext } from "@/server/tenancy/types"

/** Largest still the venue PC may upload (a 640px JPEG is ~30–80 KB). */
export const CAMERA_STILL_MAX_BYTES = 512 * 1024
const STILL_UPLOAD_GRANT_SECONDS = 120
const STILL_VIEW_GRANT_SECONDS = 300

export interface CameraAssignmentCamera {
  id: string
  label: string
  channelKey: string
  streamProfile: string
  recorderLabel: string
  enabled: boolean
  still: { url: string; capturedAt: string | null } | null
}

export interface CameraAssignmentTable {
  id: string
  label: string
  active: boolean
  primaryCameraId: string | null
  backupCameraId: string | null
}

export interface CameraAssignmentsView {
  installationId: string
  locationId: string
  cameras: CameraAssignmentCamera[]
  tables: CameraAssignmentTable[]
}

export type { CameraAssignmentInput }
export { cameraStillObjectKey }

function validate(
  input: CameraAssignmentInput[],
  known: { tableIds: Set<string>; cameraIds: Set<string> },
): CameraAssignmentInput[] {
  try {
    return normaliseCameraAssignments(input, known)
  } catch (error) {
    if (error instanceof CameraAssignmentValidationError) {
      throw new DeviceError("VALIDATION_ERROR", error.message, 400)
    }
    throw error
  }
}

async function requireInstallation(tenantId: string, installationId: string) {
  const [installation] = await db
    .select()
    .from(venueEdgeInstallations)
    .where(and(eq(venueEdgeInstallations.tenantId, tenantId), eq(venueEdgeInstallations.id, installationId)))
    .limit(1)
  if (!installation) {
    throw new DeviceError("VALIDATION_ERROR", "VenueEdge installation was not found.", 404)
  }
  return installation
}

async function loadInventory(tenantId: string, locationId: string, installationId: string) {
  const [tables, cameras, recorders, routes] = await Promise.all([
    db
      .select({ id: resources.id, name: resources.name, isActive: resources.isActive })
      .from(resources)
      .where(and(eq(resources.tenantId, tenantId), eq(resources.locationId, locationId))),
    db
      .select()
      .from(replayCameraSources)
      .where(
        and(
          eq(replayCameraSources.tenantId, tenantId),
          eq(replayCameraSources.locationId, locationId),
          eq(replayCameraSources.installationId, installationId),
          isNull(replayCameraSources.retiredAt),
        ),
      ),
    db
      .select()
      .from(replayRecorders)
      .where(
        and(
          eq(replayRecorders.tenantId, tenantId),
          eq(replayRecorders.locationId, locationId),
          eq(replayRecorders.installationId, installationId),
          isNull(replayRecorders.retiredAt),
        ),
      ),
    db
      .select()
      .from(replaySourceRoutes)
      .where(
        and(
          eq(replaySourceRoutes.tenantId, tenantId),
          eq(replaySourceRoutes.locationId, locationId),
          eq(replaySourceRoutes.installationId, installationId),
          eq(replaySourceRoutes.isEnabled, true),
          isNull(replaySourceRoutes.retiredAt),
        ),
      ),
  ])
  return { tables, cameras, recorders, routes }
}

function byChannel(left: { channelKey: string }, right: { channelKey: string }) {
  return Number(left.channelKey) - Number(right.channelKey) || left.channelKey.localeCompare(right.channelKey)
}

export async function getVenueEdgeCameraAssignments(
  context: TenantContext,
  installationId: string,
  store: MediaStore | null = safeMediaStore(),
): Promise<CameraAssignmentsView> {
  const installation = await requireInstallation(context.tenantId, installationId)
  const { tables, cameras, recorders, routes } = await loadInventory(
    context.tenantId,
    installation.locationId,
    installation.id,
  )
  const recorderLabels = new Map(recorders.map((recorder) => [recorder.id, recorder.label]))

  const stills = new Map<string, { objectKey: string; lastModified: string | null }>()
  if (store) {
    try {
      const prefix = `venue-edge/stills/${context.tenantId}/${installation.id}/`
      for (const object of await store.listPrefix(prefix)) {
        stills.set(object.objectKey, { objectKey: object.objectKey, lastModified: object.lastModified })
      }
    } catch {
      // Previews are optional; assignments still work without storage.
    }
  }

  const cameraViews: CameraAssignmentCamera[] = []
  for (const camera of [...cameras].sort(byChannel)) {
    const key = cameraStillObjectKey({
      tenantId: context.tenantId,
      installationId: installation.id,
      recorderId: camera.recorderId,
      channelKey: camera.channelKey,
    })
    const stillObject = stills.get(key)
    let still: CameraAssignmentCamera["still"] = null
    if (store && stillObject) {
      try {
        const grant = await store.createDownloadGrant({ objectKey: key, expiresInSeconds: STILL_VIEW_GRANT_SECONDS })
        still = { url: grant.url, capturedAt: stillObject.lastModified }
      } catch {
        still = null
      }
    }
    cameraViews.push({
      id: camera.id,
      label: camera.label,
      channelKey: camera.channelKey,
      streamProfile: camera.streamProfile,
      recorderLabel: recorderLabels.get(camera.recorderId) ?? "NVR",
      enabled: camera.isEnabled,
      still,
    })
  }

  const tableViews: CameraAssignmentTable[] = [...tables]
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }))
    .map((table) => {
      const tableRoutes = routes
        .filter((route) => route.resourceId === table.id)
        .sort((left, right) => left.priority - right.priority)
      return {
        id: table.id,
        label: table.name,
        active: table.isActive,
        primaryCameraId: tableRoutes[0]?.cameraSourceId ?? null,
        backupCameraId: tableRoutes[1]?.cameraSourceId ?? null,
      }
    })

  return { installationId: installation.id, locationId: installation.locationId, cameras: cameraViews, tables: tableViews }
}

export async function saveVenueEdgeCameraAssignments(
  context: TenantContext,
  installationId: string,
  assignments: CameraAssignmentInput[],
  reason: string,
) {
  const installation = await requireInstallation(context.tenantId, installationId)
  const tenantId = context.tenantId
  const locationId = installation.locationId
  const now = new Date()
  const { tables, cameras } = await loadInventory(tenantId, locationId, installation.id)
  const normalised = validate(assignments, {
    tableIds: new Set(tables.map((table) => table.id)),
    cameraIds: new Set(cameras.map((camera) => camera.id)),
  })

  await db.transaction(async (tx) => {
    for (const assignment of normalised) {
      const resourceId = assignment.tableId
      const wanted = [assignment.primaryCameraId, assignment.backupCameraId].filter(
        (id): id is string => Boolean(id),
      )

      // One policy row per table (unique per venue); claim it for this installation.
      const [policy] = await tx
        .select({ id: replaySourcePolicies.id })
        .from(replaySourcePolicies)
        .where(
          and(
            eq(replaySourcePolicies.tenantId, tenantId),
            eq(replaySourcePolicies.locationId, locationId),
            eq(replaySourcePolicies.resourceId, resourceId),
          ),
        )
        .limit(1)
      if (policy) {
        await tx
          .update(replaySourcePolicies)
          .set({ installationId: installation.id, retiredAt: null, updatedAt: now })
          .where(eq(replaySourcePolicies.id, policy.id))
      } else if (wanted.length > 0) {
        await tx.insert(replaySourcePolicies).values({
          tenantId,
          locationId,
          installationId: installation.id,
          resourceId,
          selectionMode: "automatic",
          updatedAt: now,
        })
      }

      // Switch off every current route for the table first, so the
      // one-active-camera-per-priority index never sees two at once.
      await tx
        .update(replaySourceRoutes)
        .set({ isEnabled: false, updatedAt: now })
        .where(
          and(
            eq(replaySourceRoutes.tenantId, tenantId),
            eq(replaySourceRoutes.locationId, locationId),
            eq(replaySourceRoutes.resourceId, resourceId),
            eq(replaySourceRoutes.isEnabled, true),
          ),
        )

      for (const [index, cameraSourceId] of wanted.entries()) {
        // A table/camera pair has at most one row ever (retired rows included),
        // so reuse it when it exists.
        const [existing] = await tx
          .select({ id: replaySourceRoutes.id })
          .from(replaySourceRoutes)
          .where(
            and(
              eq(replaySourceRoutes.tenantId, tenantId),
              eq(replaySourceRoutes.locationId, locationId),
              eq(replaySourceRoutes.resourceId, resourceId),
              eq(replaySourceRoutes.cameraSourceId, cameraSourceId),
            ),
          )
          .limit(1)
        if (existing) {
          await tx
            .update(replaySourceRoutes)
            .set({
              installationId: installation.id,
              priority: index + 1,
              isEnabled: true,
              retiredAt: null,
              updatedAt: now,
            })
            .where(eq(replaySourceRoutes.id, existing.id))
        } else {
          await tx.insert(replaySourceRoutes).values({
            tenantId,
            locationId,
            installationId: installation.id,
            resourceId,
            cameraSourceId,
            priority: index + 1,
            captureModes: ["edge_buffer"],
            policy: {},
            isEnabled: true,
            updatedAt: now,
          })
        }
        // A camera chosen for a table must record replays.
        await tx
          .update(replayCameraSources)
          .set({ isEnabled: true, updatedAt: now })
          .where(and(eq(replayCameraSources.tenantId, tenantId), eq(replayCameraSources.id, cameraSourceId)))
      }
    }
  })

  const topology = await buildTopologySnapshotForLocation(tenantId, locationId, installation.id)
  const revision = await publishEdgeConfigV2Revision({
    tenantId,
    locationId,
    snapshot: topology,
    createdByActorId: context.actor.type === "user" ? context.actor.id : null,
    correlationId: context.correlationId,
  })

  await writeAuditLog(context, {
    action: VENUE_EDGE_AUDIT_ACTIONS.configPublished,
    targetType: "venue_edge_installation",
    targetId: installation.id,
    metadata: {
      reason,
      revisionVersion: revision.version,
      cameraAssignments: normalised,
    },
  })

  return revision
}

/**
 * Upload grant for one camera still, requested by the venue PC. The recorder is
 * identified by the PC's local connection key, which PlayTT maps to its
 * recorder through this device's secret references.
 */
export async function createCameraStillUploadGrant(input: {
  tenantId: string
  edgeDeviceId: string
  localConnectionKey: string
  channelKey: string
  contentLength: number
  store?: MediaStore
}) {
  if (!Number.isInteger(input.contentLength) || input.contentLength <= 0 || input.contentLength > CAMERA_STILL_MAX_BYTES) {
    throw new DeviceError("VALIDATION_ERROR", "Camera still is too large.", 400)
  }
  const [installation] = await db
    .select({ id: venueEdgeInstallations.id, locationId: venueEdgeInstallations.locationId })
    .from(venueEdgeInstallations)
    .where(and(eq(venueEdgeInstallations.tenantId, input.tenantId), eq(venueEdgeInstallations.edgeDeviceId, input.edgeDeviceId)))
    .limit(1)
  if (!installation) {
    throw new DeviceError("CONFIG_NOT_READY", "This device has no VenueEdge installation.", 409)
  }
  const [secretRef] = await db
    .select({ recorderId: venueEdgeSecretRefs.recorderId })
    .from(venueEdgeSecretRefs)
    .where(
      and(
        eq(venueEdgeSecretRefs.tenantId, input.tenantId),
        eq(venueEdgeSecretRefs.edgeDeviceId, input.edgeDeviceId),
        eq(venueEdgeSecretRefs.localKey, input.localConnectionKey),
        eq(venueEdgeSecretRefs.status, "active"),
      ),
    )
    .limit(1)
  if (!secretRef?.recorderId) {
    throw new DeviceError("CONFIG_NOT_READY", "PlayTT doesn't know this recorder yet. Publish the setup first.", 409)
  }
  const store = input.store ?? createR2MediaStore()
  const grant = await store.createUploadGrant({
    objectKey: cameraStillObjectKey({
      tenantId: input.tenantId,
      installationId: installation.id,
      recorderId: secretRef.recorderId,
      channelKey: input.channelKey,
    }),
    contentType: "image/jpeg",
    maxBytes: CAMERA_STILL_MAX_BYTES,
    expiresInSeconds: STILL_UPLOAD_GRANT_SECONDS,
  })
  return { url: grant.url, method: grant.method, contentType: grant.contentType, expiresAt: grant.expiresAt }
}

function safeMediaStore(): MediaStore | null {
  try {
    return createR2MediaStore()
  } catch {
    return null
  }
}
