import { and, desc, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { venueEdgeReleases } from "@/db/schema"
import { DeviceError } from "@/server/devices/errors"
import {
  signUpdateManifest,
  type SignedVenueEdgeUpdateManifest,
  type VenueEdgeUpdateManifestPayload,
} from "@/server/replays/venue-edge-update-manifest"
import type { TenantContext } from "@/server/tenancy/types"

export type VenueEdgeReleaseStatus = "draft" | "published" | "revoked"

export interface CreateVenueEdgeReleaseInput {
  version: string
  channel: string
  platform: string
  architecture: string
  artifactUrl: string
  sha256: string
  minSupportedVersion: string
  rolloutCohort?: string | null
  rolloutPercentage?: number
  canaryInstallationIds?: string[]
  deadline?: string | null
  releaseNotes?: string | null
}

export interface VenueEdgeReleaseRecord {
  id: string
  tenantId: string
  version: string
  channel: string
  platform: string
  architecture: string
  artifactUrl: string
  sha256: string
  signature: string
  minSupportedVersion: string
  rolloutCohort: string | null
  rolloutPercentage: number
  canaryInstallationIds: string[]
  deadline: string | null
  status: VenueEdgeReleaseStatus
  releaseNotes: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

function mapRelease(
  row: typeof venueEdgeReleases.$inferSelect,
): VenueEdgeReleaseRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    version: row.version,
    channel: row.channel,
    platform: row.platform,
    architecture: row.architecture,
    artifactUrl: row.artifactUrl,
    sha256: row.sha256,
    signature: row.signature,
    minSupportedVersion: row.minSupportedVersion,
    rolloutCohort: row.rolloutCohort,
    rolloutPercentage: row.rolloutPercentage,
    canaryInstallationIds: row.canaryInstallationIds ?? [],
    deadline: row.deadline?.toISOString() ?? null,
    status: row.status as VenueEdgeReleaseStatus,
    releaseNotes: row.releaseNotes,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function requireSigningKey(privateKeyPem: string | null): string {
  if (!privateKeyPem) {
    throw new DeviceError(
      "UPDATE_SIGNING_UNAVAILABLE",
      "Update signing key is not configured.",
      503,
    )
  }

  return privateKeyPem
}

export async function createVenueEdgeReleaseDraft(
  context: TenantContext,
  input: CreateVenueEdgeReleaseInput,
  privateKeyPem: string | null,
): Promise<VenueEdgeReleaseRecord> {
  const key = requireSigningKey(privateKeyPem)
  const payload: VenueEdgeUpdateManifestPayload = {
    attemptId: "00000000-0000-0000-0000-000000000000",
    installationId: "00000000-0000-0000-0000-000000000000",
    version: input.version,
    channel: input.channel,
    minimumSupportedVersion: input.minSupportedVersion,
    platform: input.platform,
    architecture: input.architecture,
    artifactUrl: input.artifactUrl,
    sha256: input.sha256.toLowerCase(),
    rolloutCohort: input.rolloutCohort ?? null,
    deadline: input.deadline ?? null,
  }
  const signed = signUpdateManifest(payload, key)

  const [row] = await db
    .insert(venueEdgeReleases)
    .values({
      tenantId: context.tenantId,
      version: input.version,
      channel: input.channel,
      platform: input.platform,
      architecture: input.architecture,
      artifactUrl: input.artifactUrl,
      sha256: input.sha256.toLowerCase(),
      signature: signed.signature,
      minSupportedVersion: input.minSupportedVersion,
      rolloutCohort: input.rolloutCohort ?? null,
      rolloutPercentage: input.rolloutPercentage ?? 100,
      canaryInstallationIds: input.canaryInstallationIds ?? [],
      deadline: input.deadline ? new Date(input.deadline) : null,
      status: "draft",
      releaseNotes: input.releaseNotes ?? null,
    })
    .returning()

  return mapRelease(row)
}

export async function publishVenueEdgeRelease(
  context: TenantContext,
  releaseId: string,
): Promise<VenueEdgeReleaseRecord> {
  const [row] = await db
    .update(venueEdgeReleases)
    .set({
      status: "published",
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(venueEdgeReleases.tenantId, context.tenantId),
        eq(venueEdgeReleases.id, releaseId),
      ),
    )
    .returning()

  if (!row) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "VenueEdge release was not found.",
      404,
    )
  }

  return mapRelease(row)
}

export async function revokeVenueEdgeRelease(
  context: TenantContext,
  releaseId: string,
): Promise<VenueEdgeReleaseRecord> {
  const [row] = await db
    .update(venueEdgeReleases)
    .set({
      status: "revoked",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(venueEdgeReleases.tenantId, context.tenantId),
        eq(venueEdgeReleases.id, releaseId),
      ),
    )
    .returning()

  if (!row) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "VenueEdge release was not found.",
      404,
    )
  }

  return mapRelease(row)
}

export async function getPublishedVenueEdgeReleaseByVersion(input: {
  tenantId: string
  version: string
  channel: string
  platform: string
  architecture: string
}): Promise<VenueEdgeReleaseRecord | null> {
  const [row] = await db
    .select()
    .from(venueEdgeReleases)
    .where(
      and(
        eq(venueEdgeReleases.tenantId, input.tenantId),
        eq(venueEdgeReleases.version, input.version),
        eq(venueEdgeReleases.channel, input.channel),
        eq(venueEdgeReleases.platform, input.platform),
        eq(venueEdgeReleases.architecture, input.architecture),
        eq(venueEdgeReleases.status, "published"),
      ),
    )
    .limit(1)

  return row ? mapRelease(row) : null
}

export async function listPublishedVenueEdgeReleasesForChannel(input: {
  tenantId: string
  channel: string
  platform: string
  architecture: string
}): Promise<VenueEdgeReleaseRecord[]> {
  const rows = await db
    .select()
    .from(venueEdgeReleases)
    .where(
      and(
        eq(venueEdgeReleases.tenantId, input.tenantId),
        eq(venueEdgeReleases.channel, input.channel),
        eq(venueEdgeReleases.platform, input.platform),
        eq(venueEdgeReleases.architecture, input.architecture),
        eq(venueEdgeReleases.status, "published"),
      ),
    )
    .orderBy(desc(venueEdgeReleases.publishedAt))

  return rows.map(mapRelease)
}

export function buildSignedManifestForInstallation(input: {
  release: VenueEdgeReleaseRecord
  attemptId: string
  installationId: string
  privateKeyPem: string
}): SignedVenueEdgeUpdateManifest {
  const payload: VenueEdgeUpdateManifestPayload = {
    attemptId: input.attemptId,
    installationId: input.installationId,
    version: input.release.version,
    channel: input.release.channel,
    minimumSupportedVersion: input.release.minSupportedVersion,
    platform: input.release.platform,
    architecture: input.release.architecture,
    artifactUrl: input.release.artifactUrl,
    sha256: input.release.sha256,
    rolloutCohort: input.release.rolloutCohort,
    deadline: input.release.deadline,
  }

  return signUpdateManifest(payload, input.privateKeyPem)
}
