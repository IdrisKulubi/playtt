import type { EdgeCommand, EdgeConfig, EdgeV1Client } from "../cloud/client"
import type { EdgeConfigV2 } from "../cloud/config-v2"
import { commandMatchesActiveConfig } from "../cameras/source"
import { safeLog } from "../health/metrics"
import type { EdgeRepositories } from "../local-storage/repositories"
import type { ReplayOrchestrator } from "../replay/orchestrator"

export class CommandProcessor {
  constructor(
    private readonly client: EdgeV1Client,
    private readonly repositories: EdgeRepositories,
    private readonly orchestrator: ReplayOrchestrator,
    private readonly getEdgeConfig: () => EdgeConfig | null,
    private readonly getEdgeConfigV2: () => EdgeConfigV2 | null
  ) {}

  async pollAndProcess(): Promise<number> {
    const commands = await this.client.listCommands()
    let processed = 0

    for (const command of commands) {
      const handled = await this.handleCommand(command)
      if (handled) {
        processed += 1
      }
    }

    return processed
  }

  async handleCommand(command: EdgeCommand): Promise<boolean> {
    const persisted = this.repositories.upsertCommand({
      id: command.id,
      kind: command.kind,
      payload: command.payload,
      correlationId: command.correlationId,
      expiresAt: command.expiresAt,
      attemptCount: command.attemptCount,
    })

    if (
      persisted.status === "acknowledged" ||
      persisted.status === "rejected" ||
      persisted.status === "failed" ||
      persisted.status === "delivered"
    ) {
      return false
    }

    if (command.kind !== "capture_replay") {
      safeLog("warn", "Unsupported command kind", {
        commandId: command.id,
        kind: command.kind,
      })
      return false
    }

    const edgeConfig = this.getEdgeConfig()
    const edgeConfigV2 = this.getEdgeConfigV2()
    const validation = commandMatchesActiveConfig(
      edgeConfig,
      edgeConfigV2,
      command.payload.resourceId,
      command.payload.configRevisionId
    )

    if (!validation.accepted) {
      this.repositories.updateCommandStatus(command.id, "rejected", {
        reason: validation.reason,
      })

      await this.client.acknowledgeCommand(command.id, {
        idempotencyKey: `reject-${command.id}`,
        success: false,
        result: { reason: validation.reason },
      })

      return false
    }

    this.repositories.updateCommandStatus(command.id, "delivered")

    void this.orchestrator
      .processCaptureReplay(command.id, command.payload)
      .catch((error) => {
        safeLog("error", "capture_replay processing crashed", {
          commandId: command.id,
          message: error instanceof Error ? error.message : String(error),
        })
      })
    return true
  }
}
