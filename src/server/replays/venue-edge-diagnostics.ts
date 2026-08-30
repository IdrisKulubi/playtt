import { and, desc, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  deviceHeartbeats,
  venueEdgeInstallations,
  venueEdgeUpdateAttempts,
} from "@/db/schema"
import { DeviceError } from "@/server/devices/errors"
import type { TenantContext } from "@/server/tenancy/types"

function redactDiagnostics(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(input, (_key, value) => {
      if (typeof value === "string" && /password|secret|rtsp:\/\//i.test(value)) {
        return "[redacted]"
      }
      return value
    }),
  ) as Record<string, unknown>
}

export async function buildVenueEdgeInstallationDiagnostics(
  context: TenantContext,
  installationId: string,
) {
  const [installation] = await db
    .select()
    .from(venueEdgeInstallations)
    .where(
      and(
        eq(venueEdgeInstallations.tenantId, context.tenantId),
        eq(venueEdgeInstallations.id, installationId),
      ),
    )
    .limit(1)

  if (!installation) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "VenueEdge installation was not found.",
      404,
    )
  }

  const [heartbeat] = await db
    .select()
    .from(deviceHeartbeats)
    .where(
      and(
        eq(deviceHeartbeats.tenantId, context.tenantId),
        eq(deviceHeartbeats.deviceId, installation.edgeDeviceId),
      ),
    )
    .orderBy(desc(deviceHeartbeats.observedAt))
    .limit(1)

  const attempts = await db
    .select({
      id: venueEdgeUpdateAttempts.id,
      status: venueEdgeUpdateAttempts.status,
      targetVersion: venueEdgeUpdateAttempts.targetVersion,
      reasonCode: venueEdgeUpdateAttempts.reasonCode,
      startedAt: venueEdgeUpdateAttempts.startedAt,
      finishedAt: venueEdgeUpdateAttempts.finishedAt,
    })
    .from(venueEdgeUpdateAttempts)
    .where(
      and(
        eq(venueEdgeUpdateAttempts.tenantId, context.tenantId),
        eq(venueEdgeUpdateAttempts.installationId, installationId),
      ),
    )
    .orderBy(desc(venueEdgeUpdateAttempts.startedAt))
    .limit(10)

  const bundle = redactDiagnostics({
    generatedAt: new Date().toISOString(),
    installation: {
      id: installation.id,
      displayName: installation.displayName,
      platform: installation.platform,
      architecture: installation.architecture,
      currentAgentVersion: installation.currentAgentVersion,
      desiredAgentVersion: installation.desiredAgentVersion,
      updateChannel: installation.updateChannel,
      updateStatus: installation.updateStatus,
      pinnedVersion: installation.pinnedVersion,
      lastUpdateAt: installation.lastUpdateAt?.toISOString() ?? null,
      lastUpdateErrorCode: installation.lastUpdateErrorCode,
    },
    heartbeat: heartbeat
      ? {
          observedAt: heartbeat.observedAt.toISOString(),
          firmwareVersion: heartbeat.firmwareVersion,
          uptimeMs: heartbeat.uptimeMs,
          metrics: heartbeat.metrics ?? {},
        }
      : null,
    recentUpdateAttempts: attempts.map((attempt) => ({
      id: attempt.id,
      status: attempt.status,
      targetVersion: attempt.targetVersion,
      reasonCode: attempt.reasonCode,
      startedAt: attempt.startedAt.toISOString(),
      finishedAt: attempt.finishedAt?.toISOString() ?? null,
    })),
  })

  return {
    installationId,
    bundle,
    generatedAt: bundle.generatedAt,
  }
}
