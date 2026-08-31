import { readFileSync } from "node:fs"
import { join } from "node:path"

import { commandMatchesActiveConfig } from "../cameras/source.ts"
import {
  checksumEdgeConfigSnapshot,
  formatEdgeConfigChecksum,
} from "../cloud/config-v2-checksum.ts"
import { parseEdgeConfigV2 } from "../cloud/config-v2.ts"
import { selectCapturePlan } from "../selection/select-source.ts"

const fixturesRoot = join(import.meta.dirname, "..", "..", "fixtures")

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(fixturesRoot, name), "utf8"))
}

function withValidChecksum(fixture: Record<string, unknown>) {
  const topology = {
    resources: fixture.resources,
    recorders: fixture.recorders,
    sources: fixture.sources,
    resourcePolicies: fixture.resourcePolicies,
  }
  const digest = checksumEdgeConfigSnapshot(topology)
  return {
    ...fixture,
    configRevision: {
      ...(fixture.configRevision as Record<string, unknown>),
      checksum: formatEdgeConfigChecksum(digest),
    },
  }
}

function healthLookup(overrides: Record<string, { status?: string; reasonCode?: string }> = {}) {
  return {
    getStatus(sourceId: string) {
      return (overrides[sourceId]?.status as
        | "healthy"
        | "degraded"
        | "unhealthy"
        | "disabled"
        | null) ?? "healthy"
    },
    getReasonCode(sourceId: string) {
      return overrides[sourceId]?.reasonCode ?? null
    },
  }
}

export interface SingleVenueSimulatorEvidence {
  resourceId: string
  primarySourceId: string
  codec: string
  clipWindowSeconds: number
  selectedSourceId: string | null
  candidateSourceIds: string[]
  commandAccepted: boolean
  wrongResourceRejected: boolean
}

export function evaluateSingleVenueSimulatorEvidence(): SingleVenueSimulatorEvidence {
  const fixture = withValidChecksum(loadFixture("edge-v2-one-nvr.json"))
  const config = parseEdgeConfigV2(fixture)
  const resourceId = "60000000-0000-4000-8000-000000000001"
  const primarySourceId = "80000000-0000-4000-8000-000000000001"

  const plan = selectCapturePlan({
    config,
    resourceId,
    health: healthLookup(),
  })

  const policy = config.resourcePolicies.find(
    (entry) => entry.resourceId === resourceId,
  )
  const candidateSourceIds =
    policy?.candidates.map((candidate) => candidate.sourceId) ?? []

  const source = config.sources.find((entry) => entry.id === primarySourceId)
  if (!source || source.codec !== "h264") {
    throw new Error("Single-venue fixture must expose an enabled H.264 source.")
  }

  const accepted = commandMatchesActiveConfig(
    null,
    config,
    resourceId,
    config.configRevision.id,
  )
  const wrongResource = commandMatchesActiveConfig(
    null,
    config,
    "60000000-0000-4000-8000-000000009999",
    config.configRevision.id,
  )

  return {
    resourceId,
    primarySourceId,
    codec: source.codec,
    clipWindowSeconds: 15,
    selectedSourceId: plan.selected?.sourceId ?? null,
    candidateSourceIds,
    commandAccepted: accepted.accepted,
    wrongResourceRejected: wrongResource.accepted === false,
  }
}
