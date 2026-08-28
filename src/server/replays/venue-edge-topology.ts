import { randomUUID } from "node:crypto"

import { and, desc, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  locations,
  replayCameraSources,
  replayRecorders,
  replaySourcePolicies,
  replaySourceRoutes,
  resources,
  venueEdgeConfigRevisions,
  venueEdgeSecretRefs,
} from "@/db/schema"
import { DeviceError } from "@/server/devices/errors"
import type { EdgeConfigV2TopologySnapshot } from "@/server/replays/edge-config-v2-publication"
import { publishEdgeConfigV2Revision } from "@/server/replays/edge-config-v2-publication"

export interface CommissioningSnapshot {
  commissioned?: boolean
  publishedAt?: string
  nvrs?: Array<Record<string, unknown>>
  cameras?: Array<Record<string, unknown>>
  resourcePolicies?: Array<Record<string, unknown>>
  resourceRoutes?: Array<Record<string, unknown>>
  sourceHealth?: Array<Record<string, unknown>>
}

export interface TopologyCounts {
  nvrCount: number
  cameraCount: number
  enabledCameraCount: number
}

export interface SourceHealthCounts {
  healthy: number
  degraded: number
  unhealthy: number
  disabled: number
  unknown: number
}

function hostWithoutScheme(host: string): string {
  const trimmed = host.trim()
  if (!trimmed) {
    return "127.0.0.1"
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return trimmed.split("/")[0] ?? trimmed
  }
  try {
    return new URL(trimmed).hostname || trimmed
  } catch {
    return (
      trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split("/")[0] ?? trimmed
    )
  }
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(
    (entry): entry is Record<string, unknown> =>
      Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
  )
}

export function parseCommissioningSnapshot(
  value: Record<string, unknown> | null | undefined,
): CommissioningSnapshot | null {
  if (!value || typeof value !== "object") {
    return null
  }

  return {
    commissioned: value.commissioned === true,
    publishedAt:
      typeof value.publishedAt === "string" ? value.publishedAt : undefined,
    nvrs: asArray(value.nvrs),
    cameras: asArray(value.cameras),
    resourcePolicies: asArray(value.resourcePolicies),
    resourceRoutes: asArray(value.resourceRoutes),
    sourceHealth: asArray(value.sourceHealth),
  }
}

export function countTopologyFromSnapshot(
  snapshot: CommissioningSnapshot | null,
): TopologyCounts {
  if (!snapshot) {
    return { nvrCount: 0, cameraCount: 0, enabledCameraCount: 0 }
  }

  const cameras = snapshot.cameras ?? []
  return {
    nvrCount: snapshot.nvrs?.length ?? 0,
    cameraCount: cameras.length,
    enabledCameraCount: cameras.filter((camera) => camera.enabled === true).length,
  }
}

export function countSourceHealthFromMetrics(
  metrics: Record<string, unknown> | null | undefined,
): SourceHealthCounts {
  const counts: SourceHealthCounts = {
    healthy: 0,
    degraded: 0,
    unhealthy: 0,
    disabled: 0,
    unknown: 0,
  }

  const rows = asArray(metrics?.sourceHealth)
  for (const row of rows) {
    const status = typeof row.status === "string" ? row.status : "unknown"
    if (status === "healthy") counts.healthy += 1
    else if (status === "degraded") counts.degraded += 1
    else if (status === "unhealthy") counts.unhealthy += 1
    else if (status === "disabled") counts.disabled += 1
    else counts.unknown += 1
  }

  return counts
}

export function readHostSleepRisk(
  metrics: Record<string, unknown> | null | undefined,
): { hostSleepRisk: boolean; hostSleepRiskReason: string | null } {
  return {
    hostSleepRisk: metrics?.hostSleepRisk === true,
    hostSleepRiskReason:
      typeof metrics?.hostSleepRiskReason === "string"
        ? metrics.hostSleepRiskReason
        : null,
  }
}

async function assertLocation(tenantId: string, locationId: string) {
  const [location] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.tenantId, tenantId), eq(locations.id, locationId)))
    .limit(1)

  if (!location) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "Venue not found for this tenant.",
      404,
    )
  }
}

export async function ingestCommissioningSnapshotForLocation(input: {
  tenantId: string
  locationId: string
  edgeDeviceId: string
  snapshot: CommissioningSnapshot
  now?: Date
}): Promise<{ recorders: number; sources: number; routes: number; policies: number }> {
  await assertLocation(input.tenantId, input.locationId)

  const now = input.now ?? new Date()
  const inserted = {
    recorders: 0,
    sources: 0,
    routes: 0,
    policies: 0,
  }

  return db.transaction(async (tx) => {
    for (const nvr of input.snapshot.nvrs ?? []) {
      const id = typeof nvr.id === "string" ? nvr.id : randomUUID()
      const label = typeof nvr.label === "string" ? nvr.label : "NVR"
      const vendor =
        typeof nvr.vendor === "string" && nvr.vendor.length > 0
          ? nvr.vendor
          : "generic_rtsp"
      const host =
        typeof nvr.host === "string" ? hostWithoutScheme(nvr.host) : null
      const rtspPort =
        typeof nvr.rtspPort === "number" ? nvr.rtspPort : 554
      const playbackPort =
        typeof nvr.playbackPort === "number" ? nvr.playbackPort : null
      const enabled = nvr.enabled !== false
      const localConnectionKey =
        typeof nvr.localConnectionKey === "string"
          ? nvr.localConnectionKey
          : `local-nvr-${id.slice(0, 8)}`
      const username =
        typeof nvr.username === "string" ? nvr.username : null

      const recorderResult = await tx
        .insert(replayRecorders)
        .values({
          id,
          tenantId: input.tenantId,
          locationId: input.locationId,
          label,
          vendor,
          host,
          rtspPort,
          playbackPort,
          connectionConfig: {
            timeMode:
              typeof nvr.timeMode === "string" ? nvr.timeMode : "device",
          },
          isEnabled: enabled,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            replayRecorders.tenantId,
            replayRecorders.locationId,
            replayRecorders.id,
          ],
          set: {
            label,
            vendor,
            host,
            rtspPort,
            playbackPort,
            connectionConfig: {
              timeMode:
                typeof nvr.timeMode === "string" ? nvr.timeMode : "device",
            },
            isEnabled: enabled,
            updatedAt: now,
          },
        })
        .returning({ id: replayRecorders.id })

      if (recorderResult.length > 0) {
        inserted.recorders += 1
      }

      await tx
        .insert(venueEdgeSecretRefs)
        .values({
          tenantId: input.tenantId,
          locationId: input.locationId,
          edgeDeviceId: input.edgeDeviceId,
          recorderId: id,
          localKey: localConnectionKey,
          credentialVersion: 1,
          username,
          status: "active",
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            venueEdgeSecretRefs.tenantId,
            venueEdgeSecretRefs.edgeDeviceId,
            venueEdgeSecretRefs.recorderId,
            venueEdgeSecretRefs.credentialVersion,
          ],
          set: {
            localKey: localConnectionKey,
            username,
            status: "active",
            updatedAt: now,
          },
        })
    }

    for (const camera of input.snapshot.cameras ?? []) {
      const id = typeof camera.id === "string" ? camera.id : randomUUID()
      const recorderId =
        typeof camera.nvrId === "string" ? camera.nvrId : null
      if (!recorderId) {
        continue
      }

      const label = typeof camera.label === "string" ? camera.label : "Camera"
      const channelKey =
        typeof camera.channelKey === "string" ? camera.channelKey : "1"
      const streamProfile =
        typeof camera.streamProfile === "string" ? camera.streamProfile : "main"
      const enabled = camera.enabled !== false
      const codec =
        camera.codec === "h265" ? "h265" : "h264"

      const sourceResult = await tx
        .insert(replayCameraSources)
        .values({
          id,
          tenantId: input.tenantId,
          locationId: input.locationId,
          recorderId,
          channelKey,
          streamProfile,
          label,
          capabilities: { codec },
          isEnabled: enabled,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            replayCameraSources.tenantId,
            replayCameraSources.locationId,
            replayCameraSources.id,
          ],
          set: {
            recorderId,
            channelKey,
            streamProfile,
            label,
            capabilities: { codec },
            isEnabled: enabled,
            updatedAt: now,
          },
        })
        .returning({ id: replayCameraSources.id })

      if (sourceResult.length > 0) {
        inserted.sources += 1
      }
    }

    for (const route of input.snapshot.resourceRoutes ?? []) {
      const resourceId =
        typeof route.resourceId === "string" ? route.resourceId : null
      const cameraSourceId =
        typeof route.cameraId === "string" ? route.cameraId : null
      if (!resourceId || !cameraSourceId) {
        continue
      }

      const priority =
        typeof route.priority === "number" && route.priority > 0
          ? route.priority
          : 1
      const captureModes = Array.isArray(route.captureModes)
        ? route.captureModes.filter(
            (mode): mode is "edge_buffer" | "nvr_playback" =>
              mode === "edge_buffer" || mode === "nvr_playback",
          )
        : ["edge_buffer", "nvr_playback"]
      const enabled = route.enabled !== false

      const routeResult = await tx
        .insert(replaySourceRoutes)
        .values({
          tenantId: input.tenantId,
          locationId: input.locationId,
          resourceId,
          cameraSourceId,
          priority,
          captureModes,
          policy: {},
          isEnabled: enabled,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            replaySourceRoutes.tenantId,
            replaySourceRoutes.locationId,
            replaySourceRoutes.resourceId,
            replaySourceRoutes.cameraSourceId,
          ],
          set: {
            priority,
            captureModes,
            isEnabled: enabled,
            updatedAt: now,
          },
        })
        .returning({ id: replaySourceRoutes.id })

      if (routeResult.length > 0) {
        inserted.routes += 1
      }
    }

    for (const policy of input.snapshot.resourcePolicies ?? []) {
      const resourceId =
        typeof policy.resourceId === "string" ? policy.resourceId : null
      if (!resourceId) {
        continue
      }

      const selectionMode =
        policy.selectionMode === "manual" ? "manual" : "automatic"
      const manualSourceId =
        typeof policy.manualSourceId === "string"
          ? policy.manualSourceId
          : null
      const failureThreshold =
        typeof policy.failureThreshold === "number" ? policy.failureThreshold : 3
      const healthyThreshold =
        typeof policy.healthyThreshold === "number" ? policy.healthyThreshold : 2
      const cooldownSeconds =
        typeof policy.cooldownSeconds === "number" ? policy.cooldownSeconds : 60
      const autoFailback = policy.autoFailback !== false

      const policyResult = await tx
        .insert(replaySourcePolicies)
        .values({
          tenantId: input.tenantId,
          locationId: input.locationId,
          resourceId,
          selectionMode,
          manualSourceId,
          failureThreshold,
          healthyThreshold,
          cooldownSeconds,
          autoFailback,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            replaySourcePolicies.tenantId,
            replaySourcePolicies.locationId,
            replaySourcePolicies.resourceId,
          ],
          set: {
            selectionMode,
            manualSourceId,
            failureThreshold,
            healthyThreshold,
            cooldownSeconds,
            autoFailback,
            updatedAt: now,
          },
        })
        .returning({ id: replaySourcePolicies.id })

      if (policyResult.length > 0) {
        inserted.policies += 1
      }
    }

    return inserted
  })
}

export async function buildTopologySnapshotForLocation(
  tenantId: string,
  locationId: string,
): Promise<EdgeConfigV2TopologySnapshot> {
  const venueResources = await db
    .select({
      id: resources.id,
      name: resources.name,
      isActive: resources.isActive,
    })
    .from(resources)
    .where(
      and(eq(resources.tenantId, tenantId), eq(resources.locationId, locationId)),
    )

  const recorders = await db
    .select()
    .from(replayRecorders)
    .where(
      and(
        eq(replayRecorders.tenantId, tenantId),
        eq(replayRecorders.locationId, locationId),
      ),
    )

  const secretRefs = await db
    .select()
    .from(venueEdgeSecretRefs)
    .where(
      and(
        eq(venueEdgeSecretRefs.tenantId, tenantId),
        eq(venueEdgeSecretRefs.locationId, locationId),
        eq(venueEdgeSecretRefs.status, "active"),
      ),
    )

  const secretRefByRecorder = new Map(
    secretRefs.map((ref) => [ref.recorderId, ref.localKey]),
  )

  const sources = await db
    .select()
    .from(replayCameraSources)
    .where(
      and(
        eq(replayCameraSources.tenantId, tenantId),
        eq(replayCameraSources.locationId, locationId),
      ),
    )

  const routes = await db
    .select()
    .from(replaySourceRoutes)
    .where(
      and(
        eq(replaySourceRoutes.tenantId, tenantId),
        eq(replaySourceRoutes.locationId, locationId),
        eq(replaySourceRoutes.isEnabled, true),
      ),
    )

  const policies = await db
    .select()
    .from(replaySourcePolicies)
    .where(
      and(
        eq(replaySourcePolicies.tenantId, tenantId),
        eq(replaySourcePolicies.locationId, locationId),
      ),
    )

  const routesByResource = new Map<string, typeof routes>()
  for (const route of routes) {
    const bucket = routesByResource.get(route.resourceId) ?? []
    bucket.push(route)
    routesByResource.set(route.resourceId, bucket)
  }

  const venueResourceIds = new Set(venueResources.map((resource) => resource.id))
  const recorderIds = new Set(recorders.map((recorder) => recorder.id))
  const enabledRecorderIds = new Set(
    recorders
      .filter((recorder) => recorder.isEnabled)
      .map((recorder) => recorder.id),
  )
  const enabledSourceIds = new Set(
    sources
      .filter(
        (source) =>
          source.isEnabled && enabledRecorderIds.has(source.recorderId),
      )
      .map((source) => source.id),
  )
  const policyByResource = new Map(
    policies.map((policy) => [policy.resourceId, policy]),
  )

  const candidatesFor = (resourceId: string) =>
    (routesByResource.get(resourceId) ?? [])
      .filter((route) => enabledSourceIds.has(route.cameraSourceId))
      .sort((left, right) => left.priority - right.priority)
      .map((route) => ({
        sourceId: route.cameraSourceId,
        priority: route.priority,
        captureModes: route.captureModes,
      }))

  const routedResourceIds = [...venueResourceIds].filter((resourceId) =>
    candidatesFor(resourceId).some((candidate) => candidate.priority === 1),
  )

  return {
    resources: venueResources.map((resource) => ({
      resourceId: resource.id,
      tenantId,
      venueId: locationId,
      label: resource.name,
      enabled: resource.isActive && routedResourceIds.includes(resource.id),
    })),
    recorders: recorders.map((recorder) => ({
      id: recorder.id,
      label: recorder.label,
      vendor:
        recorder.vendor === "vigi" || recorder.vendor === "generic_rtsp"
          ? recorder.vendor
          : "generic_rtsp",
      enabled: recorder.isEnabled,
      connection: {
        host: hostWithoutScheme(recorder.host ?? "127.0.0.1"),
        rtspPort: recorder.rtspPort ?? 554,
      },
      localConnectionKey:
        secretRefByRecorder.get(recorder.id) ??
        `local-nvr-${recorder.id.slice(0, 8)}`,
    })),
    sources: sources
      .filter((source) => recorderIds.has(source.recorderId))
      .map((source) => ({
        id: source.id,
        recorderId: source.recorderId,
        label: source.label,
        channelKey: source.channelKey,
        streamProfile: source.streamProfile,
        codec: source.capabilities?.codec === "h265" ? "h265" : "h264",
        enabled: source.isEnabled && enabledRecorderIds.has(source.recorderId),
      })),
    resourcePolicies: routedResourceIds.map((resourceId) => {
      const existing = policyByResource.get(resourceId)
      const candidates = candidatesFor(resourceId)
      const manualSourceId =
        existing?.selectionMode === "manual" &&
        existing.manualSourceId &&
        candidates.some(
          (candidate) => candidate.sourceId === existing.manualSourceId,
        )
          ? existing.manualSourceId
          : null

      return {
        resourceId,
        selectionMode: manualSourceId ? "manual" : "automatic",
        manualSourceId,
        failover: {
          failureThreshold: existing?.failureThreshold ?? 3,
          cooldownSeconds: existing?.cooldownSeconds ?? 60,
          healthyThreshold: existing?.healthyThreshold ?? 2,
          autoFailback: existing?.autoFailback ?? true,
        },
        candidates,
      }
    }),
  }
}

export async function syncCommissioningAndPublish(input: {
  tenantId: string
  locationId: string
  edgeDeviceId: string
  snapshot: CommissioningSnapshot
  createdByActorId?: string | null
  correlationId?: string
}): Promise<{ ingested: Awaited<ReturnType<typeof ingestCommissioningSnapshotForLocation>>; revision: Awaited<ReturnType<typeof publishEdgeConfigV2Revision>> }> {
  const ingested = await ingestCommissioningSnapshotForLocation({
    tenantId: input.tenantId,
    locationId: input.locationId,
    edgeDeviceId: input.edgeDeviceId,
    snapshot: input.snapshot,
  })

  const topology = await buildTopologySnapshotForLocation(
    input.tenantId,
    input.locationId,
  )

  const revision = await publishEdgeConfigV2Revision({
    tenantId: input.tenantId,
    locationId: input.locationId,
    snapshot: topology,
    createdByActorId: input.createdByActorId,
    correlationId: input.correlationId,
  })

  return { ingested, revision }
}

export async function rollbackVenueEdgeConfigRevision(input: {
  tenantId: string
  locationId: string
  revisionId: string
  createdByActorId?: string | null
  correlationId?: string
}) {
  const [revision] = await db
    .select({
      id: venueEdgeConfigRevisions.id,
      snapshot: venueEdgeConfigRevisions.snapshot,
    })
    .from(venueEdgeConfigRevisions)
    .where(
      and(
        eq(venueEdgeConfigRevisions.tenantId, input.tenantId),
        eq(venueEdgeConfigRevisions.locationId, input.locationId),
        eq(venueEdgeConfigRevisions.id, input.revisionId),
      ),
    )
    .limit(1)

  if (!revision?.snapshot) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "Configuration revision was not found for this venue.",
      404,
    )
  }

  return publishEdgeConfigV2Revision({
    tenantId: input.tenantId,
    locationId: input.locationId,
    snapshot: revision.snapshot,
    createdByActorId: input.createdByActorId,
    correlationId: input.correlationId,
  })
}

export async function getPublishedTopologySnapshot(
  tenantId: string,
  locationId: string,
): Promise<EdgeConfigV2TopologySnapshot | null> {
  const [revision] = await db
    .select({ snapshot: venueEdgeConfigRevisions.snapshot })
    .from(venueEdgeConfigRevisions)
    .where(
      and(
        eq(venueEdgeConfigRevisions.tenantId, tenantId),
        eq(venueEdgeConfigRevisions.locationId, locationId),
        eq(venueEdgeConfigRevisions.status, "published"),
      ),
    )
    .orderBy(desc(venueEdgeConfigRevisions.version))
    .limit(1)

  if (!revision?.snapshot) {
    return null
  }

  const snapshot = revision.snapshot as EdgeConfigV2TopologySnapshot
  return {
    resources: snapshot.resources ?? [],
    recorders: snapshot.recorders ?? [],
    sources: snapshot.sources ?? [],
    resourcePolicies: snapshot.resourcePolicies ?? [],
  }
}
