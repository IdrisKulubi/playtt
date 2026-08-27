export interface VenueEdgeInstallerArtifactMetadata {
  channel: "development" | "stable"
  version: string
  downloadUrl: string | null
  minimumAgentVersion: string
  releaseNotes: string
  placeholder: boolean
  sha256: string | null
  signed: boolean
}

function readOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim()
  return value && value.length > 0 ? value : null
}

export function getVenueEdgeInstallerArtifactMetadata(): VenueEdgeInstallerArtifactMetadata {
  const downloadUrl = readOptionalEnv("VENUE_EDGE_INSTALLER_DOWNLOAD_URL")
  const sha256 = readOptionalEnv("VENUE_EDGE_INSTALLER_SHA256")
  const version =
    readOptionalEnv("VENUE_EDGE_INSTALLER_VERSION") ?? "0.1.0-rc1"
  const channel =
    readOptionalEnv("VENUE_EDGE_INSTALLER_CHANNEL") === "stable"
      ? "stable"
      : "development"

  if (downloadUrl) {
    return {
      channel,
      version,
      downloadUrl,
      minimumAgentVersion: "0.1.0",
      releaseNotes:
        "Signed Windows installer for PlayTT VenueEdge Agent. Pair at /nvr after install.",
      placeholder: false,
      sha256,
      signed: readOptionalEnv("VENUE_EDGE_INSTALLER_SIGNED") === "true",
    }
  }

  return {
    channel: "development",
    version,
    downloadUrl: null,
    minimumAgentVersion: "0.1.0",
    releaseNotes:
      "Unsigned release-candidate packaging is available via services/venue-edge/packaging/pack.ps1. Hosted download and Authenticode signing are pending certificate and artifact hosting.",
    placeholder: true,
    sha256: null,
    signed: false,
  }
}
