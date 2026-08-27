export interface VenueEdgeInstallerArtifactMetadata {
  channel: "development" | "stable"
  version: string
  downloadUrl: string | null
  minimumAgentVersion: string
  releaseNotes: string
  placeholder: boolean
}

export function getVenueEdgeInstallerArtifactMetadata(): VenueEdgeInstallerArtifactMetadata {
  return {
    channel: "development",
    version: "0.1.0-dev",
    downloadUrl: null,
    minimumAgentVersion: "0.1.0",
    releaseNotes:
      "Signed Windows installer packaging is deferred to Phase 5. Use a local VenueEdge Agent build for development pairing.",
    placeholder: true,
  }
}
