const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/

type ParsedSemver = {
  core: [number, number, number]
  prerelease: string[] | null
}

export type EdgeAgentVersionValidation =
  | { success: true; version: string }
  | {
      success: false
      code: "AGENT_VERSION_REQUIRED" | "AGENT_UPGRADE_REQUIRED"
      message: string
    }

function parseSemver(value: string): ParsedSemver | null {
  const match = SEMVER_PATTERN.exec(value)
  if (!match) return null
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
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

export function validateEdgeAgentVersion(
  version: string | null,
  minimumVersion: string
): EdgeAgentVersionValidation {
  if (!version || compareSemver(version, minimumVersion) === null) {
    return {
      success: false,
      code: "AGENT_VERSION_REQUIRED",
      message: `VenueEdge Agent version is required and must be valid. Upgrade to ${minimumVersion} or newer and retry.`,
    }
  }
  if ((compareSemver(version, minimumVersion) ?? -1) < 0) {
    return {
      success: false,
      code: "AGENT_UPGRADE_REQUIRED",
      message: `VenueEdge Agent ${version} is unsupported for Config v2. Upgrade to ${minimumVersion} or newer.`,
    }
  }
  return { success: true, version }
}
