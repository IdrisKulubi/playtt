import { compareSemver } from "@/server/replays/edge-agent-version"
import {
  isInstallationEligibleForRollout,
  type VenueEdgeUpdateChannel,
} from "@/server/replays/venue-edge-update-manifest"
import type { VenueEdgeReleaseRecord } from "@/server/replays/venue-edge-releases"

export interface VenueEdgeInstallationUpdateState {
  id: string
  currentAgentVersion: string
  desiredAgentVersion: string | null
  updateChannel: string
  pinnedVersion: string | null
  platform: string
  architecture: string
}

export function resolveEffectiveUpdateChannel(
  installation: VenueEdgeInstallationUpdateState,
): VenueEdgeUpdateChannel {
  if (installation.pinnedVersion) {
    return "pinned"
  }

  const channel = installation.updateChannel
  if (
    channel === "pilot" ||
    channel === "stable" ||
    channel === "emergency" ||
    channel === "development"
  ) {
    return channel
  }

  return "stable"
}

export function pickReleaseForInstallation(
  installation: VenueEdgeInstallationUpdateState,
  releases: VenueEdgeReleaseRecord[],
): VenueEdgeReleaseRecord | null {
  if (installation.pinnedVersion) {
    return (
      releases.find((release) => release.version === installation.pinnedVersion) ??
      null
    )
  }

  if (installation.desiredAgentVersion) {
    const desired = releases.find(
      (release) => release.version === installation.desiredAgentVersion,
    )
    if (desired) {
      return desired
    }
  }

  const eligible = releases
    .filter((release) =>
      isInstallationEligibleForRollout({
        installationId: installation.id,
        rolloutPercentage: release.rolloutPercentage,
        canaryInstallationIds: release.canaryInstallationIds,
      }),
    )
    .sort((left, right) => {
      const comparison = compareSemver(left.version, right.version)
      return comparison === null ? 0 : -comparison
    })

  return eligible[0] ?? null
}

export function shouldOfferUpdate(input: {
  installation: VenueEdgeInstallationUpdateState
  release: VenueEdgeReleaseRecord
}): boolean {
  if (input.release.version === input.installation.currentAgentVersion) {
    return false
  }

  if (
    compareSemver(
      input.release.version,
      input.installation.currentAgentVersion,
    ) === 0
  ) {
    return false
  }

  return true
}

export function resolveDesiredAgentVersion(
  installation: VenueEdgeInstallationUpdateState,
  release: VenueEdgeReleaseRecord | null,
): string | null {
  if (installation.pinnedVersion) {
    return installation.pinnedVersion
  }

  if (installation.desiredAgentVersion) {
    return installation.desiredAgentVersion
  }

  return release?.version ?? null
}
