import { readFile } from "node:fs/promises"
import { join } from "node:path"

import {
  collectRedactedDiagnostics,
  diagnosticsContainForbiddenMaterial,
} from "../health/diagnostics"
import type { SourceHealthEngine } from "../health/engine"
import { readHostResourceMetrics } from "../config/budgets"
import type { VenueEdgeEnv } from "../config/env"

const MAX_BUNDLE_BYTES = 256 * 1024
const MAX_LOG_LINES = 200

export interface SupportBundleInput {
  env: VenueEdgeEnv
  installationId: string | null
  currentVersion: string
  platform: string
  architecture: string
  healthEngine?: SourceHealthEngine | null
  recentFailureCodes?: string[]
  logPath?: string | null
}

export async function buildSupportBundle(
  input: SupportBundleInput,
): Promise<Record<string, unknown>> {
  const hostResources = await readHostResourceMetrics(input.env)
  const sourceHealth = input.healthEngine?.getHeartbeatHealthSnapshot() ?? []
  const bundle = collectRedactedDiagnostics({
    generatedAt: new Date().toISOString(),
    installationId: input.installationId,
    versions: {
      agent: input.currentVersion,
      platform: input.platform,
      architecture: input.architecture,
    },
    health: {
      sourceHealth,
      bufferAgeSeconds: input.healthEngine?.getMaxBufferAgeSeconds() ?? null,
      cpuPercent: hostResources.cpuPercent,
      freeMemoryBytes: hostResources.freeMemoryBytes,
      diskUsageBytes: hostResources.diskUsageBytes,
      diskPressure: hostResources.diskPressure,
    },
    recentFailureCodes: (input.recentFailureCodes ?? []).slice(0, 20),
    logs: await readBoundedLogTail(input.logPath),
  })

  const serialized = JSON.stringify(bundle)
  if (Buffer.byteLength(serialized, "utf8") > MAX_BUNDLE_BYTES) {
    return collectRedactedDiagnostics({
      generatedAt: bundle.generatedAt,
      installationId: bundle.installationId,
      versions: bundle.versions,
      health: bundle.health,
      recentFailureCodes: bundle.recentFailureCodes,
      truncated: true,
    })
  }

  return bundle
}

async function readBoundedLogTail(
  logPath: string | null | undefined,
): Promise<string[]> {
  if (!logPath) {
    return []
  }

  try {
    const raw = await readFile(logPath, "utf8")
    return raw
      .split(/\r?\n/)
      .slice(-MAX_LOG_LINES)
      .map((line) => line.slice(0, 500))
  } catch {
    return []
  }
}

export function assertSupportBundleSafe(
  bundle: Record<string, unknown>,
  forbidden: string[],
): void {
  if (diagnosticsContainForbiddenMaterial(bundle, forbidden)) {
    throw new Error("SUPPORT_BUNDLE_SECRET_SCAN_FAILED")
  }
}

export function resolveDefaultLogPath(dataDir: string): string {
  return join(dataDir, "logs", "venue-edge.log")
}
