import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto"

import { compareSemver } from "./edge-agent-version"

export type {
  VenueEdgeInstallationRolloutState,
  VenueEdgeReleaseRolloutCandidate,
} from "./venue-edge-rollout-policy"
export {
  isInstallationEligibleForRollout,
  isReleaseEligibleForInstallation,
  releaseMatchesInstallationCohort,
  resolveInstallationRolloutCohort,
  rolloutBucketForInstallation,
} from "./venue-edge-rollout-policy"

export const VENUE_EDGE_UPDATE_CHANNELS = [
  "pilot",
  "stable",
  "pinned",
  "emergency",
  "development",
] as const

export type VenueEdgeUpdateChannel =
  (typeof VENUE_EDGE_UPDATE_CHANNELS)[number]

export const VENUE_EDGE_UPDATE_STATUSES = [
  "idle",
  "staged",
  "applying",
  "succeeded",
  "failed",
  "rolled_back",
] as const

export type VenueEdgeUpdateStatus =
  (typeof VENUE_EDGE_UPDATE_STATUSES)[number]

export const VENUE_EDGE_UPDATE_ATTEMPT_STATUSES = [
  "started",
  "succeeded",
  "failed",
  "rolled_back",
] as const

export type VenueEdgeUpdateAttemptStatus =
  (typeof VENUE_EDGE_UPDATE_ATTEMPT_STATUSES)[number]

export interface VenueEdgeUpdateManifestPayload {
  attemptId: string
  installationId: string
  version: string
  channel: string
  minimumSupportedVersion: string
  platform: string
  architecture: string
  artifactUrl: string
  sha256: string
  rolloutCohort: string | null
  deadline: string | null
}

export interface SignedVenueEdgeUpdateManifest
  extends VenueEdgeUpdateManifestPayload {
  signature: string
}

export type VenueEdgeUpdateManifestRejectionCode =
  | "UPDATE_MANIFEST_UNSIGNED"
  | "UPDATE_MANIFEST_TAMPERED"
  | "UPDATE_MANIFEST_WRONG_PLATFORM"
  | "UPDATE_MANIFEST_WRONG_ARCHITECTURE"
  | "UPDATE_MANIFEST_EXPIRED"
  | "UPDATE_MANIFEST_DOWNGRADE"
  | "UPDATE_MANIFEST_INVALID"

export interface VenueEdgeUpdateManifestValidation {
  valid: boolean
  code?: VenueEdgeUpdateManifestRejectionCode
  message?: string
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry))
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = canonicalize(record[key])
        return accumulator
      }, {})
  }

  return value
}

export function canonicalizeUpdateManifestPayload(
  payload: VenueEdgeUpdateManifestPayload,
): string {
  return JSON.stringify(canonicalize(payload))
}

export function readUpdateSigningPrivateKey(): string | null {
  const configured = process.env.VENUE_EDGE_UPDATE_PRIVATE_KEY?.trim()
  return configured && configured.length > 0 ? configured : null
}

export function readUpdateVerificationPublicKey(): string | null {
  const configured = process.env.VENUE_EDGE_UPDATE_PUBLIC_KEY?.trim()
  return configured && configured.length > 0 ? configured : null
}

export function signUpdateManifest(
  payload: VenueEdgeUpdateManifestPayload,
  privateKeyPem: string,
): SignedVenueEdgeUpdateManifest {
  const canonical = canonicalizeUpdateManifestPayload(payload)
  const key = createPrivateKey(privateKeyPem)
  const signature = sign(null, Buffer.from(canonical, "utf8"), key).toString(
    "base64",
  )

  return {
    ...payload,
    signature,
  }
}

export function verifyUpdateManifestSignature(
  manifest: SignedVenueEdgeUpdateManifest,
  publicKeyPem: string,
): boolean {
  if (!manifest.signature?.trim()) {
    return false
  }

  const { signature, ...payload } = manifest
  const canonical = canonicalizeUpdateManifestPayload(payload)

  try {
    const key = createPublicKey(publicKeyPem)
    return verify(
      null,
      Buffer.from(canonical, "utf8"),
      key,
      Buffer.from(signature, "base64"),
    )
  } catch {
    return false
  }
}

export function validateUpdateManifest(input: {
  manifest: SignedVenueEdgeUpdateManifest
  currentVersion: string
  platform: string
  architecture: string
  publicKeyPem: string
  allowDowngrade?: boolean
  now?: Date
}): VenueEdgeUpdateManifestValidation {
  const { manifest, currentVersion, platform, architecture, publicKeyPem } =
    input
  const now = input.now ?? new Date()

  if (!manifest.signature?.trim()) {
    return {
      valid: false,
      code: "UPDATE_MANIFEST_UNSIGNED",
      message: "Update manifest is missing a signature.",
    }
  }

  if (!verifyUpdateManifestSignature(manifest, publicKeyPem)) {
    return {
      valid: false,
      code: "UPDATE_MANIFEST_TAMPERED",
      message: "Update manifest signature verification failed.",
    }
  }

  if (manifest.platform !== platform) {
    return {
      valid: false,
      code: "UPDATE_MANIFEST_WRONG_PLATFORM",
      message: "Update manifest targets a different platform.",
    }
  }

  if (manifest.architecture !== architecture) {
    return {
      valid: false,
      code: "UPDATE_MANIFEST_WRONG_ARCHITECTURE",
      message: "Update manifest targets a different architecture.",
    }
  }

  if (manifest.deadline) {
    const deadline = new Date(manifest.deadline)
    if (Number.isNaN(deadline.getTime()) || deadline.getTime() < now.getTime()) {
      return {
        valid: false,
        code: "UPDATE_MANIFEST_EXPIRED",
        message: "Update manifest deadline has passed.",
      }
    }
  }

  if (
    compareSemver(currentVersion, manifest.minimumSupportedVersion) !== null &&
    (compareSemver(currentVersion, manifest.minimumSupportedVersion) ?? -1) < 0
  ) {
    return {
      valid: false,
      code: "UPDATE_MANIFEST_DOWNGRADE",
      message: "Current agent version is below the minimum supported version.",
    }
  }

  if (
    !input.allowDowngrade &&
    compareSemver(manifest.version, currentVersion) !== null &&
    (compareSemver(manifest.version, currentVersion) ?? 1) < 0 &&
    manifest.channel !== "emergency"
  ) {
    return {
      valid: false,
      code: "UPDATE_MANIFEST_DOWNGRADE",
      message: "Downgrade updates are not permitted for this channel.",
    }
  }

  if (!/^https:\/\//i.test(manifest.artifactUrl)) {
    return {
      valid: false,
      code: "UPDATE_MANIFEST_INVALID",
      message: "Update artifact URL must use HTTPS.",
    }
  }

  if (!/^[a-f0-9]{64}$/i.test(manifest.sha256)) {
    return {
      valid: false,
      code: "UPDATE_MANIFEST_INVALID",
      message: "Update artifact hash must be a SHA-256 hex digest.",
    }
  }

  return { valid: true }
}

export function hashUpdateArtifact(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex")
}
