import { and, eq, inArray } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  venueEdgeConfigApplications,
  venueEdgeConfigRevisions,
  venueEdgeInstallations,
} from "@/db/schema"
import { DeviceError } from "@/server/devices/errors"
import { assertSafeEdgeConfigV2ErrorDetails } from "@/server/replays/edge-config-v2-diagnostics"
import { assertVenueEdgeConfigV2Enabled } from "@/server/replays/venue-edge-config-v2-gate"
import { VENUE_EDGE_AUDIT_ACTIONS } from "@/server/replays/venue-edge-audit-actions"
import { writeAuditLogInTransaction } from "@/server/tenancy/audit-log-write"
import type { TenantContext } from "@/server/tenancy/types"

export type EdgeConfigV2ApplicationStatus = "applied" | "rejected"

export interface EdgeConfigV2ApplicationResult {
  id: string
  installationId: string
  configRevisionId: string
  status: EdgeConfigV2ApplicationStatus
  attemptedAt: string
  appliedAt: string | null
  idempotent: boolean
}

export async function acknowledgeEdgeConfigV2Application(input: {
  tenantId: string
  locationId: string
  deviceId: string
  deviceType: string
  installationId: string
  configRevisionId: string
  status: EdgeConfigV2ApplicationStatus
  bootId?: string | null
  errorCode?: string | null
  errorDetails?: Record<string, unknown> | null
  auditContext?: TenantContext
  now?: Date
}): Promise<EdgeConfigV2ApplicationResult> {
  if (input.deviceType !== "venue_edge") {
    throw new DeviceError(
      "DEVICE_FORBIDDEN",
      "Only a VenueEdge device can acknowledge edge configuration v2.",
      403
    )
  }
  if (input.status === "applied" && (input.errorCode || input.errorDetails)) {
    throw new DeviceError(
      "CONFIG_INVALID",
      "Applied configuration acknowledgements cannot include error details.",
      422
    )
  }
  if (input.status === "rejected" && !input.errorCode) {
    throw new DeviceError(
      "CONFIG_INVALID",
      "Rejected configuration acknowledgements require an error code.",
      422
    )
  }
  if (input.errorDetails) {
    try {
      assertSafeEdgeConfigV2ErrorDetails(input.errorDetails)
    } catch (error) {
      throw new DeviceError(
        "CONFIG_INVALID",
        error instanceof Error
          ? error.message
          : "Configuration error details are invalid.",
        422
      )
    }
  }

  const attemptedAt = input.now ?? new Date()
  await assertVenueEdgeConfigV2Enabled(input.tenantId, input.locationId)

  const auditContext: TenantContext = input.auditContext ?? {
    tenantId: input.tenantId,
    actor: { type: "device", id: input.deviceId },
    correlationId: `venue-edge-config-ack-${input.configRevisionId}`,
  }

  return db.transaction(async (tx) => {
    const [installation] = await tx
      .select({
        id: venueEdgeInstallations.id,
        installationUid: venueEdgeInstallations.installationUid,
      })
      .from(venueEdgeInstallations)
      .where(
        and(
          eq(venueEdgeInstallations.tenantId, input.tenantId),
          eq(venueEdgeInstallations.locationId, input.locationId),
          eq(venueEdgeInstallations.edgeDeviceId, input.deviceId),
          eq(venueEdgeInstallations.installationUid, input.installationId)
        )
      )
      .limit(1)

    if (!installation) {
      throw new DeviceError(
        "CONFIG_NOT_READY",
        "VenueEdge installation does not match this authenticated device.",
        404
      )
    }

    const [revision] = await tx
      .select({ id: venueEdgeConfigRevisions.id })
      .from(venueEdgeConfigRevisions)
      .where(
        and(
          eq(venueEdgeConfigRevisions.tenantId, input.tenantId),
          eq(venueEdgeConfigRevisions.locationId, input.locationId),
          eq(venueEdgeConfigRevisions.id, input.configRevisionId),
          inArray(venueEdgeConfigRevisions.status, ["published", "superseded"])
        )
      )
      .limit(1)

    if (!revision) {
      throw new DeviceError(
        "CONFIG_VERSION_INVALID",
        "Configuration revision is not available to this installation.",
        409
      )
    }

    const [existing] = await tx
      .select()
      .from(venueEdgeConfigApplications)
      .where(
        and(
          eq(venueEdgeConfigApplications.tenantId, input.tenantId),
          eq(venueEdgeConfigApplications.locationId, input.locationId),
          eq(venueEdgeConfigApplications.edgeDeviceId, input.deviceId),
          eq(
            venueEdgeConfigApplications.configRevisionId,
            input.configRevisionId
          )
        )
      )
      .limit(1)
      .for("update")

    if (existing && existing.status !== "pending") {
      if (existing.status !== input.status) {
        throw new DeviceError(
          "CONFIG_VERSION_INVALID",
          "Configuration revision already has a different terminal result.",
          409
        )
      }
      return {
        id: existing.id,
        installationId: installation.installationUid,
        configRevisionId: existing.configRevisionId,
        status: existing.status,
        attemptedAt: existing.attemptedAt.toISOString(),
        appliedAt: existing.appliedAt?.toISOString() ?? null,
        idempotent: true,
      }
    }

    const applicationValues = {
      tenantId: input.tenantId,
      locationId: input.locationId,
      edgeDeviceId: input.deviceId,
      configRevisionId: input.configRevisionId,
      status: input.status,
      bootId: input.bootId ?? null,
      attemptedAt,
      appliedAt: input.status === "applied" ? attemptedAt : null,
      errorCode: input.status === "rejected" ? input.errorCode : null,
      errorDetails:
        input.status === "rejected" ? (input.errorDetails ?? null) : null,
      updatedAt: attemptedAt,
    } as const

    const [application] = existing
      ? await tx
          .update(venueEdgeConfigApplications)
          .set(applicationValues)
          .where(
            and(
              eq(venueEdgeConfigApplications.id, existing.id),
              eq(venueEdgeConfigApplications.tenantId, input.tenantId),
              eq(venueEdgeConfigApplications.locationId, input.locationId),
              eq(venueEdgeConfigApplications.edgeDeviceId, input.deviceId),
              eq(venueEdgeConfigApplications.status, "pending")
            )
          )
          .returning()
      : await tx
          .insert(venueEdgeConfigApplications)
          .values(applicationValues)
          .onConflictDoNothing({
            target: [
              venueEdgeConfigApplications.tenantId,
              venueEdgeConfigApplications.edgeDeviceId,
              venueEdgeConfigApplications.configRevisionId,
            ],
          })
          .returning()

    if (!application) {
      const [concurrent] = await tx
        .select()
        .from(venueEdgeConfigApplications)
        .where(
          and(
            eq(venueEdgeConfigApplications.tenantId, input.tenantId),
            eq(venueEdgeConfigApplications.locationId, input.locationId),
            eq(venueEdgeConfigApplications.edgeDeviceId, input.deviceId),
            eq(
              venueEdgeConfigApplications.configRevisionId,
              input.configRevisionId
            )
          )
        )
        .limit(1)

      if (!concurrent || concurrent.status !== input.status) {
        throw new DeviceError(
          "CONFIG_VERSION_INVALID",
          "Configuration acknowledgement conflicted with another result.",
          409
        )
      }
      return {
        id: concurrent.id,
        installationId: installation.installationUid,
        configRevisionId: concurrent.configRevisionId,
        status: concurrent.status,
        attemptedAt: concurrent.attemptedAt.toISOString(),
        appliedAt: concurrent.appliedAt?.toISOString() ?? null,
        idempotent: true,
      }
    }

    if (application.status === "applied") {
      await tx
        .update(venueEdgeInstallations)
        .set({
          lastConfigAppliedAt: application.appliedAt,
          updatedAt: attemptedAt,
        })
        .where(
          and(
            eq(venueEdgeInstallations.id, installation.id),
            eq(venueEdgeInstallations.tenantId, input.tenantId),
            eq(venueEdgeInstallations.locationId, input.locationId),
            eq(venueEdgeInstallations.edgeDeviceId, input.deviceId),
            eq(venueEdgeInstallations.installationUid, input.installationId)
          )
        )
    }

    await writeAuditLogInTransaction(tx, auditContext, {
      action:
        application.status === "applied"
          ? VENUE_EDGE_AUDIT_ACTIONS.configApplied
          : VENUE_EDGE_AUDIT_ACTIONS.configRejected,
      targetType: "venue_edge_config_application",
      targetId: application.id,
      metadata: {
        locationId: input.locationId,
        configRevisionId: input.configRevisionId,
        installationId: input.installationId,
        status: application.status,
        errorCode: input.errorCode ?? null,
      },
    })

    return {
      id: application.id,
      installationId: installation.installationUid,
      configRevisionId: application.configRevisionId,
      status: application.status as EdgeConfigV2ApplicationStatus,
      attemptedAt: application.attemptedAt.toISOString(),
      appliedAt: application.appliedAt?.toISOString() ?? null,
      idempotent: false,
    }
  })
}
