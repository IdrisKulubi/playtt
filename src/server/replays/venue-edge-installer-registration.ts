import { and, eq, inArray } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  locations,
  tenants,
  venueEdgeInstallerPilotEligibility,
  venueEdgeInstallerReleases,
} from "@/db/schema"
import { DeviceError } from "@/server/devices/errors"

interface RegisterVenueEdgeInstallerBase {
  version: string
  objectKey: string
  fileName: string
  sha256: string
  sizeBytes: number
  signed: boolean
  signaturePublisher?: string | null
  releaseNotes?: string | null
  minimumWindowsVersion?: string
}

export type RegisterVenueEdgeInstallerInput = RegisterVenueEdgeInstallerBase & {
  channel: "pilot" | "stable"
  pilotLocationIds?: string[]
  targetTenantIds?: string[]
}

function assertReleaseSafety(input: RegisterVenueEdgeInstallerInput) {
  const checksum = input.sha256.toLowerCase()
  if (!/^[0-9A-Za-z][0-9A-Za-z.-]{0,63}$/.test(input.version)) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "Installer version must be safe for an immutable object key.",
      400
    )
  }
  if (!/^[a-zA-Z0-9._-]+\.exe$/.test(input.fileName)) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "Installer filename must be a safe .exe filename.",
      400
    )
  }
  if (input.channel === "stable" && !input.signed) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "Stable installer registration requires a verified Authenticode signature.",
      400
    )
  }
  if (input.signed && !input.signaturePublisher?.trim()) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "Signed installer registration requires the verified publisher name.",
      400
    )
  }
  const expectedObjectKey = `venue-edge/installers/${input.channel}/${input.version}/${checksum}/${input.fileName}`
  if (input.objectKey !== expectedObjectKey) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "The R2 object key must exactly match the channel, version, checksum, and filename.",
      400
    )
  }
}

export async function registerVenueEdgeInstaller(
  input: RegisterVenueEdgeInstallerInput
) {
  assertReleaseSafety(input)
  const targetLocationsByTenant = new Map<string, string[]>()
  let targetTenantIds: string[]

  if (input.channel === "pilot") {
    const pilotLocationIds = [...new Set(input.pilotLocationIds ?? [])]
    if (pilotLocationIds.length === 0) {
      throw new DeviceError(
        "VALIDATION_ERROR",
        "At least one pilot venue is required.",
        400
      )
    }
    const venueRows = await db
      .select({ id: locations.id, tenantId: locations.tenantId })
      .from(locations)
      .where(inArray(locations.id, pilotLocationIds))
    if (venueRows.length !== pilotLocationIds.length) {
      throw new DeviceError(
        "VALIDATION_ERROR",
        "One or more pilot venues were not found.",
        404
      )
    }
    for (const venue of venueRows) {
      const tenantLocations = targetLocationsByTenant.get(venue.tenantId) ?? []
      tenantLocations.push(venue.id)
      targetLocationsByTenant.set(venue.tenantId, tenantLocations)
    }
    targetTenantIds = [...targetLocationsByTenant.keys()]
  } else {
    targetTenantIds = [...new Set(input.targetTenantIds ?? [])]
    if (targetTenantIds.length === 0) {
      throw new DeviceError(
        "VALIDATION_ERROR",
        "At least one stable-release tenant is required.",
        400
      )
    }
    const existingTenants = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(inArray(tenants.id, targetTenantIds))
    if (existingTenants.length !== targetTenantIds.length) {
      throw new DeviceError(
        "VALIDATION_ERROR",
        "One or more stable release tenants were not found.",
        404
      )
    }
  }

  const publishedAt = new Date()
  return db.transaction(async (tx) => {
    const registered: Array<{
      tenantId: string
      releaseId: string
      locationCount: number
    }> = []
    for (const tenantId of targetTenantIds) {
      const [existing] = await tx
        .select()
        .from(venueEdgeInstallerReleases)
        .where(
          and(
            eq(venueEdgeInstallerReleases.tenantId, tenantId),
            eq(venueEdgeInstallerReleases.version, input.version),
            eq(venueEdgeInstallerReleases.channel, input.channel),
            eq(venueEdgeInstallerReleases.platform, "windows"),
            eq(venueEdgeInstallerReleases.architecture, "x64")
          )
        )
        .limit(1)

      if (
        existing &&
        (existing.sha256.toLowerCase() !== input.sha256.toLowerCase() ||
          existing.objectKey !== input.objectKey)
      ) {
        throw new DeviceError(
          "VALIDATION_ERROR",
          `Version ${input.version} is already registered with a different artifact.`,
          409
        )
      }

      const values = {
        objectKey: input.objectKey,
        fileName: input.fileName,
        sha256: input.sha256.toLowerCase(),
        sizeBytes: input.sizeBytes,
        isSigned: input.signed,
        signaturePublisher: input.signaturePublisher?.trim() || null,
        minimumWindowsVersion: input.minimumWindowsVersion ?? "10 22H2",
        status: "published",
        releaseNotes: input.releaseNotes?.trim() || null,
        publishedAt,
        withdrawnAt: null,
        updatedAt: publishedAt,
      }

      const [release] = existing
        ? await tx
            .update(venueEdgeInstallerReleases)
            .set(values)
            .where(
              and(
                eq(venueEdgeInstallerReleases.tenantId, tenantId),
                eq(venueEdgeInstallerReleases.id, existing.id)
              )
            )
            .returning()
        : await tx
            .insert(venueEdgeInstallerReleases)
            .values({
              tenantId,
              version: input.version,
              channel: input.channel,
              platform: "windows",
              architecture: "x64",
              ...values,
            })
            .returning()

      const eligibleLocationIds = targetLocationsByTenant.get(tenantId) ?? []

      if (input.channel === "pilot" && eligibleLocationIds.length > 0) {
        await tx
          .update(venueEdgeInstallerPilotEligibility)
          .set({ revokedAt: publishedAt })
          .where(
            and(
              eq(venueEdgeInstallerPilotEligibility.tenantId, tenantId),
              eq(venueEdgeInstallerPilotEligibility.releaseId, release.id)
            )
          )
        await tx
          .insert(venueEdgeInstallerPilotEligibility)
          .values(
            eligibleLocationIds.map((locationId) => ({
              tenantId,
              releaseId: release.id,
              locationId,
              grantedByUserId: null,
            }))
          )
          .onConflictDoUpdate({
            target: [
              venueEdgeInstallerPilotEligibility.tenantId,
              venueEdgeInstallerPilotEligibility.releaseId,
              venueEdgeInstallerPilotEligibility.locationId,
            ],
            set: { revokedAt: null, expiresAt: null },
          })
      }

      registered.push({
        tenantId,
        releaseId: release.id,
        locationCount: eligibleLocationIds.length,
      })
    }
    return registered
  })
}

export async function withdrawVenueEdgeInstaller(input: {
  tenantId: string
  releaseId: string
}) {
  const withdrawnAt = new Date()
  const [release] = await db
    .update(venueEdgeInstallerReleases)
    .set({ status: "withdrawn", withdrawnAt, updatedAt: withdrawnAt })
    .where(
      and(
        eq(venueEdgeInstallerReleases.tenantId, input.tenantId),
        eq(venueEdgeInstallerReleases.id, input.releaseId)
      )
    )
    .returning({
      id: venueEdgeInstallerReleases.id,
      tenantId: venueEdgeInstallerReleases.tenantId,
      status: venueEdgeInstallerReleases.status,
      withdrawnAt: venueEdgeInstallerReleases.withdrawnAt,
    })

  if (!release) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "Installer release was not found.",
      404
    )
  }
  return release
}
