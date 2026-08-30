import type { EdgeConfigV2 } from "../cloud/config-v2"
import {
  checksumEdgeConfigSnapshot,
  formatEdgeConfigChecksum,
} from "../cloud/config-v2-checksum"
import { parseEdgeConfigV2 } from "../cloud/config-v2"
import type { EdgeV1Client } from "../cloud/client"
import { EdgeProtocolError } from "../cloud/client"
import type { EdgeRepositories } from "../local-storage/repositories"
import { safeLog } from "../health/metrics"
import { buildSourcePlan, type SourcePlan } from "./source-plan"

export interface EdgeConfigRuntimeState {
  edgeConfigV2: EdgeConfigV2 | null
  appliedConfigVersion: number | undefined
}

export interface ConfigApplyResult {
  applied: boolean
  idempotent: boolean
  sourcePlan: SourcePlan | null
  errorCode?: string
}

export interface ConfigApplyOptions {
  acknowledge?: boolean
  activate?: (
    config: EdgeConfigV2 | null,
    plan: SourcePlan | null
  ) => Promise<void>
}

type ConfigStaleReason = "version_not_newer" | "installation_mismatch"

class ConfigStaleError extends Error {
  readonly details: Record<string, unknown>

  constructor(reason: ConfigStaleReason, details: Record<string, unknown>) {
    super("CONFIG_STALE")
    this.details = { staleReason: reason, ...details }
  }
}

function topologyFromConfig(config: EdgeConfigV2) {
  return {
    resources: config.resources,
    recorders: config.recorders,
    sources: config.sources,
    resourcePolicies: config.resourcePolicies,
  }
}

function verifyChecksum(config: EdgeConfigV2): void {
  const topology = topologyFromConfig(config)
  const digest = checksumEdgeConfigSnapshot(topology)
  const expected = formatEdgeConfigChecksum(config.configRevision.checksum)
  const actual = formatEdgeConfigChecksum(digest)

  if (expected !== actual) {
    throw new Error("CONFIG_CHECKSUM_MISMATCH")
  }
}

export class EdgeConfigV2Manager {
  private edgeConfigV2: EdgeConfigV2 | null = null

  constructor(
    private readonly repositories: EdgeRepositories,
    private readonly client: EdgeV1Client,
    private readonly bootId: string
  ) {}

  getState(): EdgeConfigRuntimeState {
    return {
      edgeConfigV2: this.edgeConfigV2,
      appliedConfigVersion: this.edgeConfigV2?.configRevision.version,
    }
  }

  loadLastKnownGoodFromDisk(): EdgeConfigV2 | null {
    const current = this.repositories.getCurrentConfig()
    if (!current) {
      return null
    }

    try {
      const parsed = parseEdgeConfigV2(current.snapshot)
      verifyChecksum(parsed)
      this.edgeConfigV2 = parsed
      return parsed
    } catch (error) {
      safeLog("warn", "Stored edge config v2 failed validation; ignoring", {
        message: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  async refreshFromCloud(
    options: Pick<ConfigApplyOptions, "activate"> = {}
  ): Promise<ConfigApplyResult> {
    try {
      const remote = await this.client.getConfigV2()
      return await this.applyValidatedSnapshot(remote, {
        acknowledge: true,
        activate: options.activate,
      })
    } catch (error) {
      if (error instanceof EdgeProtocolError) {
        if (
          error.code === "DEVICE_FORBIDDEN" ||
          error.code === "AGENT_UPGRADE_REQUIRED" ||
          error.code === "AGENT_VERSION_REQUIRED" ||
          error.status === 403 ||
          error.status === 426
        ) {
          safeLog("info", "Config v2 unavailable; keeping last-known-good", {
            code: error.code,
            status: error.status,
          })
          return {
            applied: false,
            idempotent: true,
            sourcePlan: null,
          }
        }
      }

      safeLog("warn", "Config v2 fetch failed; keeping last-known-good", {
        message: error instanceof Error ? error.message : String(error),
      })

      return {
        applied: false,
        idempotent: true,
        sourcePlan: null,
      }
    }
  }

  async applyValidatedSnapshot(
    input: unknown,
    options: ConfigApplyOptions = {}
  ): Promise<ConfigApplyResult> {
    const previous = this.edgeConfigV2
    let parsed: EdgeConfigV2

    try {
      parsed = parseEdgeConfigV2(input)
      verifyChecksum(parsed)
    } catch (error) {
      return await this.rejectSnapshot(input, options, error)
    }

    const current = this.repositories.getCurrentConfig()
    if (
      current &&
      current.revisionId === parsed.configRevision.id &&
      current.version === parsed.configRevision.version
    ) {
      this.edgeConfigV2 = parsed
      if (options.acknowledge) {
        try {
          await this.acknowledgeApplied(parsed)
        } catch (error) {
          safeLog("warn", "Failed to acknowledge applied config", {
            message: error instanceof Error ? error.message : String(error),
          })
        }
      }
      return {
        applied: false,
        idempotent: true,
        sourcePlan: buildSourcePlan(previous, parsed),
      }
    }

    if (current && current.installationId !== parsed.installation.id) {
      return await this.rejectSnapshot(
        input,
        options,
        new ConfigStaleError("installation_mismatch", {
          localInstallationId: current.installationId,
          localRevisionId: current.revisionId,
          localVersion: current.version,
          receivedInstallationId: parsed.installation.id,
          receivedRevisionId: parsed.configRevision.id,
          receivedVersion: parsed.configRevision.version,
          remediation: "Reset the local config cache or use the replace-PC flow before applying this installation.",
        })
      )
    }

    if (current && parsed.configRevision.version <= current.version) {
      return await this.rejectSnapshot(
        input,
        options,
        new ConfigStaleError("version_not_newer", {
          installationId: current.installationId,
          localRevisionId: current.revisionId,
          localVersion: current.version,
          receivedRevisionId: parsed.configRevision.id,
          receivedVersion: parsed.configRevision.version,
          remediation: "Publish a revision with a version greater than the locally applied version.",
        })
      )
    }

    const sourcePlan = buildSourcePlan(previous, parsed)
    let activationAttempted = false

    try {
      if (options.activate) {
        activationAttempted = true
        await options.activate(parsed, sourcePlan)
      }

      const appliedAt = new Date().toISOString()
      this.repositories.applyConfigSnapshot({
        revisionId: parsed.configRevision.id,
        version: parsed.configRevision.version,
        checksum: parsed.configRevision.checksum,
        installationId: parsed.installation.id,
        publishedAt: parsed.configRevision.publishedAt,
        snapshot: parsed,
        appliedAt,
        bootId: this.bootId,
      })

      this.edgeConfigV2 = parsed
    } catch (error) {
      if (activationAttempted && options.activate) {
        try {
          await options.activate(
            previous,
            previous ? buildSourcePlan(parsed, previous) : null
          )
        } catch (rollbackError) {
          safeLog("error", "Failed to roll back runtime config activation", {
            message:
              rollbackError instanceof Error
                ? rollbackError.message
                : String(rollbackError),
          })
        }
      }

      return await this.rejectSnapshot(input, options, error)
    }

    if (options.acknowledge) {
      try {
        await this.acknowledgeApplied(parsed)
      } catch (error) {
        safeLog("warn", "Failed to acknowledge applied config", {
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return {
      applied: true,
      idempotent: false,
      sourcePlan,
    }
  }

  private async rejectSnapshot(
    input: unknown,
    options: ConfigApplyOptions,
    error: unknown
  ): Promise<ConfigApplyResult> {
    const errorCode =
      error instanceof Error &&
      (error.message === "CONFIG_CHECKSUM_MISMATCH" ||
        error.message === "CONFIG_STALE")
        ? error.message
        : "CONFIG_INVALID"

    if (options.acknowledge && input && typeof input === "object") {
      const revision = (input as { configRevision?: { id?: string } })
        .configRevision
      const installation = (input as { installation?: { id?: string } })
        .installation
      if (revision?.id && installation?.id) {
        try {
          await this.client.acknowledgeConfigV2Application({
            installationId: installation.id,
            configRevisionId: revision.id,
            status: "rejected",
            bootId: this.bootId,
            errorCode,
            errorDetails: {
              code: errorCode,
              message:
                error instanceof Error ? error.message : "Invalid snapshot.",
              ...(error instanceof ConfigStaleError ? error.details : {}),
            },
          })
        } catch (ackError) {
          safeLog("warn", "Failed to acknowledge rejected config", {
            message:
              ackError instanceof Error ? ackError.message : String(ackError),
          })
        }
      }
    }

    return {
      applied: false,
      idempotent: false,
      sourcePlan: null,
      errorCode,
    }
  }

  rollbackToPreviousOnDisk(): EdgeConfigV2 | null {
    const rolled = this.repositories.rollbackToPrevious()
    if (!rolled) {
      return null
    }

    const parsed = parseEdgeConfigV2(rolled.snapshot)
    verifyChecksum(parsed)
    this.edgeConfigV2 = parsed
    return parsed
  }

  resetLocalConfigCache(): void {
    this.repositories.clearConfigSnapshots()
    this.edgeConfigV2 = null
  }

  private async acknowledgeApplied(config: EdgeConfigV2): Promise<void> {
    await this.client.acknowledgeConfigV2Application({
      installationId: config.installation.id,
      configRevisionId: config.configRevision.id,
      status: "applied",
      bootId: this.bootId,
    })
  }
}
