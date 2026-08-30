import { createHash } from "node:crypto"

export interface VenueEdgeInstallationRolloutState {
  id: string
  locationId: string
  updateChannel: string
  rolloutCohortTag?: string | null
}

export interface VenueEdgeReleaseRolloutCandidate {
  version: string
  rolloutCohort: string | null
  rolloutPercentage: number
  canaryInstallationIds: string[]
}

export function rolloutBucketForInstallation(installationId: string): number {
  const digest = createHash("sha256").update(installationId).digest()
  return digest[0] % 100
}

export function isInstallationEligibleForRollout(input: {
  installationId: string
  rolloutPercentage: number
  canaryInstallationIds: string[]
}): boolean {
  if (input.canaryInstallationIds.includes(input.installationId)) {
    return true
  }

  if (input.rolloutPercentage >= 100) {
    return true
  }

  if (input.rolloutPercentage <= 0) {
    return false
  }

  return rolloutBucketForInstallation(input.installationId) < input.rolloutPercentage
}

export function resolveInstallationRolloutCohort(
  installation: VenueEdgeInstallationRolloutState,
): string {
  const explicit = installation.rolloutCohortTag?.trim()
  if (explicit) {
    return explicit
  }

  return installation.updateChannel
}

export function releaseMatchesInstallationCohort(
  installation: VenueEdgeInstallationRolloutState,
  release: VenueEdgeReleaseRolloutCandidate,
): boolean {
  if (!release.rolloutCohort) {
    return true
  }

  const cohortTag = resolveInstallationRolloutCohort(installation)
  return (
    release.rolloutCohort === cohortTag ||
    release.rolloutCohort === installation.updateChannel ||
    release.rolloutCohort === installation.locationId
  )
}

export function isReleaseEligibleForInstallation(
  installation: VenueEdgeInstallationRolloutState,
  release: VenueEdgeReleaseRolloutCandidate,
): boolean {
  return (
    releaseMatchesInstallationCohort(installation, release) &&
    isInstallationEligibleForRollout({
      installationId: installation.id,
      rolloutPercentage: release.rolloutPercentage,
      canaryInstallationIds: release.canaryInstallationIds,
    })
  )
}
