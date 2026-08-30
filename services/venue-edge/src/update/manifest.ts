import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto"

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

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/

function parseSemver(value: string) {
  const match = SEMVER_PATTERN.exec(value)
  if (!match) return null
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])] as const,
    prerelease: match[4]?.split(".") ?? null,
  }
}

export function compareSemver(left: string, right: string): number | null {
  const a = parseSemver(left)
  const b = parseSemver(right)
  if (!a || !b) return null
  for (let index = 0; index < a.core.length; index += 1) {
    if (a.core[index] !== b.core[index]) {
      return a.core[index] < b.core[index] ? -1 : 1
    }
  }
  if (!a.prerelease && !b.prerelease) return 0
  if (!a.prerelease) return 1
  if (!b.prerelease) return -1
  const length = Math.max(a.prerelease.length, b.prerelease.length)
  for (let index = 0; index < length; index += 1) {
    const aPart = a.prerelease[index]
    const bPart = b.prerelease[index]
    if (aPart === undefined) return -1
    if (bPart === undefined) return 1
    if (aPart === bPart) continue
    const aNumeric = /^\d+$/.test(aPart)
    const bNumeric = /^\d+$/.test(bPart)
    if (aNumeric && bNumeric) return Number(aPart) < Number(bPart) ? -1 : 1
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1
    return aPart < bPart ? -1 : 1
  }
  return 0
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
}): { valid: boolean; code?: VenueEdgeUpdateManifestRejectionCode } {
  const { manifest, currentVersion, platform, architecture, publicKeyPem } =
    input
  const now = input.now ?? new Date()

  if (!manifest.signature?.trim()) {
    return { valid: false, code: "UPDATE_MANIFEST_UNSIGNED" }
  }

  if (!verifyUpdateManifestSignature(manifest, publicKeyPem)) {
    return { valid: false, code: "UPDATE_MANIFEST_TAMPERED" }
  }

  if (manifest.platform !== platform) {
    return { valid: false, code: "UPDATE_MANIFEST_WRONG_PLATFORM" }
  }

  if (manifest.architecture !== architecture) {
    return { valid: false, code: "UPDATE_MANIFEST_WRONG_ARCHITECTURE" }
  }

  if (manifest.deadline) {
    const deadline = new Date(manifest.deadline)
    if (Number.isNaN(deadline.getTime()) || deadline.getTime() < now.getTime()) {
      return { valid: false, code: "UPDATE_MANIFEST_EXPIRED" }
    }
  }

  if (
    compareSemver(currentVersion, manifest.minimumSupportedVersion) !== null &&
    (compareSemver(currentVersion, manifest.minimumSupportedVersion) ?? -1) < 0
  ) {
    return { valid: false, code: "UPDATE_MANIFEST_DOWNGRADE" }
  }

  if (
    !input.allowDowngrade &&
    compareSemver(manifest.version, currentVersion) !== null &&
    (compareSemver(manifest.version, currentVersion) ?? 1) < 0 &&
    manifest.channel !== "emergency"
  ) {
    return { valid: false, code: "UPDATE_MANIFEST_DOWNGRADE" }
  }

  if (!/^https:\/\//i.test(manifest.artifactUrl)) {
    return { valid: false, code: "UPDATE_MANIFEST_INVALID" }
  }

  if (!/^[a-f0-9]{64}$/i.test(manifest.sha256)) {
    return { valid: false, code: "UPDATE_MANIFEST_INVALID" }
  }

  return { valid: true }
}

export function hashUpdateArtifact(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex")
}
