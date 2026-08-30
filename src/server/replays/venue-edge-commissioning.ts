import { createHash } from "node:crypto"

import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { devices, venueEdgeInstallations } from "@/db/schema"
import { DeviceError } from "@/server/devices/errors"
import { VENUE_EDGE_AUDIT_ACTIONS } from "@/server/replays/venue-edge-audit-actions"
import { writeAuditLogInTransaction } from "@/server/tenancy/audit-log-write"
import type { TenantContext } from "@/server/tenancy/types"

const SECRET_KEY_PATTERN =
  /(?:password|passwd|secret|token|credential|authorization|api[_-]?key|private[_-]?key)/i
const URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i

function scanCommissioningPayload(
  value: unknown,
  path = "$",
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      scanCommissioningPayload(entry, `${path}[${index}]`),
    )
    return
  }

  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const nestedPath = `${path}.${key}`
      if (SECRET_KEY_PATTERN.test(key)) {
        throw new DeviceError(
          "CONFIG_INVALID",
          `Commissioning payload contains forbidden secret field at ${nestedPath}.`,
          422,
        )
      }
      scanCommissioningPayload(nested, nestedPath)
    }
    return
  }

  if (typeof value !== "string" || !URL_PATTERN.test(value)) {
    return
  }

  try {
    const parsed = new URL(value)
    const secretQuery = [...parsed.searchParams.keys()].some((key) =>
      SECRET_KEY_PATTERN.test(key),
    )
    if (parsed.username || parsed.password || secretQuery) {
      throw new DeviceError(
        "CONFIG_INVALID",
        `Commissioning payload contains credentialized URL at ${path}.`,
        422,
      )
    }
  } catch (error) {
    if (error instanceof DeviceError) {
      throw error
    }
  }
}

export function assertSafeCommissioningPayload(
  payload: Record<string, unknown>,
): void {
  scanCommissioningPayload(payload)
}

export interface PublishedVenueEdgeCommissioning {
  publishedAt: string
  commissioned: boolean
  installationId: string
}

export async function publishVenueEdgeCommissioning(input: {
  tenantId: string
  locationId: string
  deviceId: string
  deviceType: string
  payload: Record<string, unknown>
  auditContext: TenantContext
  now?: Date
}): Promise<PublishedVenueEdgeCommissioning> {
  if (input.deviceType !== "venue_edge") {
    throw new DeviceError(
      "DEVICE_FORBIDDEN",
      "Only venue-edge devices can publish commissioning snapshots.",
      403,
    )
  }

  assertSafeCommissioningPayload(input.payload)

  const receivedReportVersion =
    typeof input.payload.reportVersion === "number" &&
    Number.isSafeInteger(input.payload.reportVersion) &&
    input.payload.reportVersion > 0
      ? input.payload.reportVersion
      : null
  const reportForChecksum = { ...input.payload }
  delete reportForChecksum.reportChecksumSha256
  const computedChecksum = createHash("sha256")
    .update(JSON.stringify(reportForChecksum))
    .digest("hex")
  const receivedChecksum =
    typeof input.payload.reportChecksumSha256 === "string"
      ? input.payload.reportChecksumSha256.toLowerCase()
      : null
  if (receivedChecksum && receivedChecksum !== computedChecksum) {
    throw new DeviceError(
      "CONFIG_CHECKSUM_MISMATCH",
      "Commissioning report checksum does not match its payload.",
      422,
    )
  }

  const commissioned = input.payload.commissioned === true

  const publishedAtRaw = input.payload.publishedAt
  const publishedAt =
    typeof publishedAtRaw === "string" && publishedAtRaw.trim().length > 0
      ? publishedAtRaw
      : (input.now ?? new Date()).toISOString()

  const now = input.now ?? new Date()

  return db.transaction(async (tx) => {
    const [installation] = await tx
      .select({
        id: venueEdgeInstallations.id,
        installationUid: venueEdgeInstallations.installationUid,
        lastReportVersion: venueEdgeInstallations.lastReportVersion,
      })
      .from(venueEdgeInstallations)
      .innerJoin(
        devices,
        and(
          eq(devices.tenantId, venueEdgeInstallations.tenantId),
          eq(devices.locationId, venueEdgeInstallations.locationId),
          eq(devices.id, venueEdgeInstallations.edgeDeviceId),
        ),
      )
      .where(
        and(
          eq(venueEdgeInstallations.tenantId, input.tenantId),
          eq(venueEdgeInstallations.locationId, input.locationId),
          eq(venueEdgeInstallations.edgeDeviceId, input.deviceId),
        ),
      )
      .limit(1)

    if (!installation) {
      throw new DeviceError(
        "CONFIG_NOT_READY",
        "VenueEdge installation does not match this authenticated device.",
        404,
      )
    }


    const reportVersion = receivedReportVersion ?? (installation.lastReportVersion ?? 0) + 1
    if (
      receivedReportVersion !== null &&
      installation.lastReportVersion !== null &&
      receivedReportVersion <= installation.lastReportVersion
    ) {
      throw new DeviceError(
        "CONFIG_STALE",
        "This commissioning report is older than the latest accepted report.",
        409,
      )
    }

    const updateValues: {
      commissioningSnapshotJson: Record<string, unknown>
      updatedAt: Date
      commissionedAt: Date | null
      lastReportVersion: number
      lastReportChecksumSha256: string | null
      lastReportedAt: Date
    } = {
      commissioningSnapshotJson: input.payload,
      updatedAt: now,
      commissionedAt: commissioned ? now : null,
      lastReportVersion: reportVersion,
      lastReportChecksumSha256: receivedChecksum ?? computedChecksum,
      lastReportedAt: now,
    }

    await tx
      .update(venueEdgeInstallations)
      .set(updateValues)
      .where(
        and(
          eq(venueEdgeInstallations.id, installation.id),
          eq(venueEdgeInstallations.tenantId, input.tenantId),
          eq(venueEdgeInstallations.locationId, input.locationId),
          eq(venueEdgeInstallations.edgeDeviceId, input.deviceId),
        ),
      )

    await writeAuditLogInTransaction(tx, input.auditContext, {
      action: VENUE_EDGE_AUDIT_ACTIONS.commissioningPublished,
      targetType: "venue_edge_installation",
      targetId: installation.id,
      metadata: {
        commissioned,
        publishedAt,
        deviceId: input.deviceId,
        locationId: input.locationId,
      },
    })

    return {
      publishedAt,
      commissioned,
      installationId: installation.installationUid,
    }
  })
}
