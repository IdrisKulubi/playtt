import { safeLog } from "../health/metrics"
import type { EdgeV1Client } from "../cloud/client"
import { applyStagedUpdate, restorePreviousInstall } from "./applier"
import {
  downloadUpdateArtifact,
  readPartialDownloadBytes,
  resolveStagedArtifactPath,
} from "./downloader"
import {
  validateUpdateManifest,
  type SignedVenueEdgeUpdateManifest,
} from "./manifest"
import { clearStagedUpdate, stageUpdateBundle } from "./stager"

export interface VenueEdgeUpdaterDeps {
  client: EdgeV1Client
  dataDir: string
  currentVersion: string
  platform: string
  architecture: string
  publicKeyPem: string | null
  fetchImpl?: typeof fetch
  restartService?: () => Promise<void>
  healthCheck?: () => Promise<boolean>
}

export interface VenueEdgeUpdateManifestResponse {
  manifest: SignedVenueEdgeUpdateManifest | null
  desiredVersion: string | null
  currentVersion: string
  updateStatus: string
  attemptId: string | null
}

export class VenueEdgeUpdater {
  private running = false

  constructor(private readonly deps: VenueEdgeUpdaterDeps) {}

  async pollAndApply(): Promise<void> {
    if (this.running) {
      return
    }

    this.running = true

    try {
      const response = await this.deps.client.getUpdateManifest()
      if (!response.manifest) {
        return
      }

      await this.applyManifest(
        response.manifest as unknown as import("./manifest").SignedVenueEdgeUpdateManifest,
      )
    } catch (error) {
      safeLog("warn", "VenueEdge update poll failed", {
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      this.running = false
    }
  }

  async applyManifest(manifest: SignedVenueEdgeUpdateManifest): Promise<void> {
    const publicKeyPem = this.deps.publicKeyPem
    if (!publicKeyPem) {
      await this.reportResult(manifest.attemptId, "failed", "UPDATE_PUBLIC_KEY_MISSING")
      return
    }

    const validation = validateUpdateManifest({
      manifest,
      currentVersion: this.deps.currentVersion,
      platform: this.deps.platform,
      architecture: this.deps.architecture,
      publicKeyPem,
    })

    if (!validation.valid) {
      await this.reportResult(
        manifest.attemptId,
        "failed",
        validation.code ?? "UPDATE_MANIFEST_INVALID",
      )
      return
    }

    const artifactPath = resolveStagedArtifactPath(
      this.deps.dataDir,
      manifest.attemptId,
    )
    const resumeFromBytes = await readPartialDownloadBytes(`${artifactPath}.part`)

    try {
      await downloadUpdateArtifact({
        url: manifest.artifactUrl,
        destinationPath: artifactPath,
        expectedSha256: manifest.sha256,
        fetchImpl: this.deps.fetchImpl,
        resumeFromBytes,
      })

      const staged = await stageUpdateBundle({
        dataDir: this.deps.dataDir,
        attemptId: manifest.attemptId,
        artifactPath,
        version: manifest.version,
      })

      const applied = await applyStagedUpdate({
        dataDir: this.deps.dataDir,
        attemptId: manifest.attemptId,
        version: manifest.version,
        stagedDir: staged.stagedDir,
        restartService: this.deps.restartService,
        healthCheck: this.deps.healthCheck,
      })

      await this.reportResult(
        manifest.attemptId,
        "succeeded",
        null,
        applied.appliedVersion,
      )
    } catch (error) {
      const reasonCode =
        error instanceof Error ? error.message : "UPDATE_APPLY_FAILED"

      try {
        const restored = await restorePreviousInstall(this.deps.dataDir)
        await clearStagedUpdate(this.deps.dataDir, manifest.attemptId)
        await this.reportResult(
          manifest.attemptId,
          "rolled_back",
          reasonCode,
          restored.restoredVersion,
        )
      } catch {
        await this.reportResult(manifest.attemptId, "failed", reasonCode)
      }
    }
  }

  private async reportResult(
    attemptId: string,
    status: "succeeded" | "failed" | "rolled_back",
    reasonCode: string | null,
    appliedVersion?: string | null,
  ): Promise<void> {
    await this.deps.client.reportUpdateResult({
      attemptId,
      status,
      reasonCode,
      appliedVersion: appliedVersion ?? null,
    })
  }
}
