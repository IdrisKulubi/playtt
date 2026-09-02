import { and, desc, eq, gt, isNull, or } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  locations,
  venueEdgeInstallerDownloadAudits,
  venueEdgeInstallerPilotEligibility,
  venueEdgeInstallerReleases,
} from "@/db/schema"
import { DeviceError } from "@/server/devices/errors"
import { createVenueEdgeInstallerDownloadGrant } from "@/server/media/r2-adapter"
import type { TenantContext } from "@/server/tenancy/types"

export interface VenueEdgeInstallerArtifactMetadata {
  id: string | null
  channel: "pilot" | "stable"
  version: string
  downloadUrl: string | null
  minimumAgentVersion: string
  windowsRequirement: string
  releaseNotes: string
  placeholder: boolean
  sha256: string | null
  sizeBytes: number | null
  signed: boolean
  signaturePublisher: string | null
}

const EMPTY_INSTALLER: VenueEdgeInstallerArtifactMetadata = {
  id: null,
  channel: "pilot",
  version: "Not published",
  downloadUrl: null,
  minimumAgentVersion: "0.2.0",
  windowsRequirement: "Windows 10 or 11, 64-bit",
  releaseNotes:
    "A VenueEdge installer has not been published for this venue yet. Pairing remains unavailable until the pilot artifact is approved.",
  placeholder: true,
  sha256: null,
  sizeBytes: null,
  signed: false,
  signaturePublisher: null,
}

function mapRelease(
  release: typeof venueEdgeInstallerReleases.$inferSelect,
  locationId: string
): VenueEdgeInstallerArtifactMetadata {
  return {
    id: release.id,
    channel: release.channel as "pilot" | "stable",
    version: release.version,
    downloadUrl: `/api/operator/venue-edge/installer-download?locationId=${encodeURIComponent(locationId)}&releaseId=${encodeURIComponent(release.id)}`,
    minimumAgentVersion: "0.2.0",
    windowsRequirement: `Windows ${release.minimumWindowsVersion}+ · 64-bit`,
    releaseNotes:
      release.releaseNotes ??
      "Installs VenueEdge and all required video tools, then opens guided setup.",
    placeholder: false,
    sha256: release.sha256,
    sizeBytes: release.sizeBytes,
    signed: release.isSigned,
    signaturePublisher: release.signaturePublisher,
  }
}

async function assertLocation(tenantId: string, locationId: string) {
  const [location] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.tenantId, tenantId), eq(locations.id, locationId)))
    .limit(1)
  if (!location) {
    throw new DeviceError("VALIDATION_ERROR", "Venue was not found.", 404)
  }
}

function activePilotWindow(now: Date) {
  return and(
    isNull(venueEdgeInstallerPilotEligibility.revokedAt),
    or(
      isNull(venueEdgeInstallerPilotEligibility.expiresAt),
      gt(venueEdgeInstallerPilotEligibility.expiresAt, now)
    )
  )
}

export async function getVenueEdgeInstallerArtifactMetadata(
  context: TenantContext,
  locationId: string
): Promise<VenueEdgeInstallerArtifactMetadata> {
  await assertLocation(context.tenantId, locationId)
  const now = new Date()

  const [stable] = await db
    .select({ release: venueEdgeInstallerReleases })
    .from(venueEdgeInstallerReleases)
    .where(
      and(
        eq(venueEdgeInstallerReleases.tenantId, context.tenantId),
        eq(venueEdgeInstallerReleases.channel, "stable"),
        eq(venueEdgeInstallerReleases.platform, "windows"),
        eq(venueEdgeInstallerReleases.architecture, "x64"),
        eq(venueEdgeInstallerReleases.status, "published"),
        eq(venueEdgeInstallerReleases.isSigned, true)
      )
    )
    .orderBy(desc(venueEdgeInstallerReleases.publishedAt))
    .limit(1)

  if (stable) return mapRelease(stable.release, locationId)

  const [pilot] = await db
    .select({ release: venueEdgeInstallerReleases })
    .from(venueEdgeInstallerReleases)
    .innerJoin(
      venueEdgeInstallerPilotEligibility,
      and(
        eq(
          venueEdgeInstallerPilotEligibility.tenantId,
          venueEdgeInstallerReleases.tenantId
        ),
        eq(
          venueEdgeInstallerPilotEligibility.releaseId,
          venueEdgeInstallerReleases.id
        )
      )
    )
    .where(
      and(
        eq(venueEdgeInstallerReleases.tenantId, context.tenantId),
        eq(venueEdgeInstallerReleases.channel, "pilot"),
        eq(venueEdgeInstallerReleases.platform, "windows"),
        eq(venueEdgeInstallerReleases.architecture, "x64"),
        eq(venueEdgeInstallerReleases.status, "published"),
        eq(venueEdgeInstallerPilotEligibility.locationId, locationId),
        activePilotWindow(now)
      )
    )
    .orderBy(desc(venueEdgeInstallerReleases.publishedAt))
    .limit(1)

  return pilot ? mapRelease(pilot.release, locationId) : EMPTY_INSTALLER
}

async function recordDownload(input: {
  context: TenantContext
  releaseId: string
  locationId: string
  outcome: "allowed" | "denied"
  reasonCode?: string | null
  expiresAt?: Date | null
}) {
  await db.insert(venueEdgeInstallerDownloadAudits).values({
    tenantId: input.context.tenantId,
    releaseId: input.releaseId,
    locationId: input.locationId,
    requestedByUserId:
      input.context.actor.type === "user" ? input.context.actor.id : null,
    outcome: input.outcome,
    reasonCode: input.reasonCode ?? null,
    correlationId: input.context.correlationId,
    downloadUrlExpiresAt: input.expiresAt ?? null,
  })
}

export async function createInstallerDownloadForVenue(input: {
  context: TenantContext
  locationId: string
  releaseId: string
  acknowledgeUnsignedPilot: boolean
}) {
  await assertLocation(input.context.tenantId, input.locationId)
  const [release] = await db
    .select()
    .from(venueEdgeInstallerReleases)
    .where(
      and(
        eq(venueEdgeInstallerReleases.tenantId, input.context.tenantId),
        eq(venueEdgeInstallerReleases.id, input.releaseId),
        eq(venueEdgeInstallerReleases.status, "published")
      )
    )
    .limit(1)

  if (!release) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "This installer is no longer available. Refresh the page for the current release.",
      404
    )
  }

  let denialReason: string | null = null
  if (release.channel === "stable" && !release.isSigned) {
    denialReason = "STABLE_RELEASE_NOT_SIGNED"
  } else if (release.channel === "pilot") {
    const [eligibility] = await db
      .select({ id: venueEdgeInstallerPilotEligibility.id })
      .from(venueEdgeInstallerPilotEligibility)
      .where(
        and(
          eq(
            venueEdgeInstallerPilotEligibility.tenantId,
            input.context.tenantId
          ),
          eq(venueEdgeInstallerPilotEligibility.releaseId, release.id),
          eq(venueEdgeInstallerPilotEligibility.locationId, input.locationId),
          activePilotWindow(new Date())
        )
      )
      .limit(1)
    if (!eligibility) denialReason = "VENUE_NOT_IN_PILOT"
    else if (!release.isSigned && !input.acknowledgeUnsignedPilot) {
      denialReason = "UNSIGNED_PILOT_NOT_ACKNOWLEDGED"
    }
  }

  if (denialReason) {
    await recordDownload({
      context: input.context,
      releaseId: release.id,
      locationId: input.locationId,
      outcome: "denied",
      reasonCode: denialReason,
    })
    throw new DeviceError(
      "VALIDATION_ERROR",
      denialReason === "UNSIGNED_PILOT_NOT_ACKNOWLEDGED"
        ? "Acknowledge the unsigned pilot warning before downloading."
        : "This venue is not eligible for this installer.",
      403
    )
  }

  const grant = await createVenueEdgeInstallerDownloadGrant({
    objectKey: release.objectKey,
    fileName: release.fileName,
    expiresInSeconds: 120,
  })
  await recordDownload({
    context: input.context,
    releaseId: release.id,
    locationId: input.locationId,
    outcome: "allowed",
    expiresAt: grant.expiresAt,
  })
  return grant
}
