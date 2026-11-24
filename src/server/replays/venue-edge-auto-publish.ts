// When a paired venue PC sends its setup snapshot, publish it as the venue's
// configuration straight away so the installer never has to switch to the
// admin dashboard to approve it. Tenants that want a human review can turn on
// the `venue_edge_manual_approval` flag; the dashboard's "Publish reviewed
// configuration" button keeps working either way.

import { DeviceError } from "@/server/devices/errors"
import { VENUE_EDGE_AUDIT_ACTIONS } from "@/server/replays/venue-edge-audit-actions"
import { isFeatureFlagEnabledForTarget } from "@/server/replays/feature-policy"
import {
  parseCommissioningSnapshot,
  syncCommissioningAndPublish,
} from "@/server/replays/venue-edge-topology"
import { writeAuditLog } from "@/server/tenancy/audit-log.mjs"
import type { TenantContext } from "@/server/tenancy/types"

export const VENUE_EDGE_MANUAL_APPROVAL_FLAG_KEY = "venue_edge_manual_approval"

export type VenueEdgeAutoPublishResult =
  | { status: "published"; revisionVersion: number }
  | { status: "needs_approval" }
  | { status: "failed"; code: string; message: string }

export async function autoPublishVenueEdgeSnapshot(input: {
  tenantId: string
  locationId: string
  deviceId: string
  installationRecordId: string
  reportVersion: number
  reportChecksumSha256: string
  payload: Record<string, unknown>
  auditContext: TenantContext
}): Promise<VenueEdgeAutoPublishResult> {
  const manualApproval = await isFeatureFlagEnabledForTarget(
    input.tenantId,
    VENUE_EDGE_MANUAL_APPROVAL_FLAG_KEY,
    { locationId: input.locationId },
  )
  if (manualApproval) {
    return { status: "needs_approval" }
  }

  const snapshot = parseCommissioningSnapshot(input.payload)
  if (!snapshot) {
    return { status: "failed", code: "CONFIG_INVALID", message: "The setup snapshot could not be read." }
  }

  try {
    const result = await syncCommissioningAndPublish({
      tenantId: input.tenantId,
      locationId: input.locationId,
      edgeDeviceId: input.deviceId,
      installationId: input.installationRecordId,
      reportVersion: input.reportVersion,
      reportChecksumSha256: input.reportChecksumSha256,
      snapshot,
      createdByActorId: null,
      correlationId: input.auditContext.correlationId,
    })

    await writeAuditLog(input.auditContext, {
      action: VENUE_EDGE_AUDIT_ACTIONS.configPublished,
      targetType: "venue_edge_installation",
      targetId: input.installationRecordId,
      metadata: {
        reason: "Published automatically from the venue PC setup",
        mode: "auto_from_venue_pc",
        revisionVersion: result.revision.version,
        ingested: result.ingested,
      },
    })

    return { status: "published", revisionVersion: result.revision.version }
  } catch (error) {
    // The snapshot itself is already saved; publishing can still be done from the dashboard.
    if (error instanceof DeviceError) {
      return { status: "failed", code: error.code, message: error.message }
    }
    console.error("VenueEdge auto-publish failed", {
      installationId: input.installationRecordId,
      locationId: input.locationId,
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      status: "failed",
      code: "CONFIG_PUBLISH_FAILED",
      message: "PlayTT saved the setup but couldn't publish it. Publish it from the admin dashboard.",
    }
  }
}
