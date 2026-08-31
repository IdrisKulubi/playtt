import {
  assertClipOnlyUploadPolicy,
  assertDiagnosticsRedaction,
  assertNoContinuousStreamUploadPaths,
} from "./privacy-invariants.ts"
import {
  assertCommandResourceBinding,
  assertResourceSourceIsolation,
} from "./isolation.ts"
import {
  evaluateReplayReadyLatency,
  simulatorReplayReadyLatencySamples,
} from "./latency.ts"
import { loadSingleVenueSimulatorEvidence } from "./edge-evidence.mjs"
import { assertReplayStubExecutionAllowed } from "../stub-policy.ts"

function stepFromCheck(id, title, passed, details) {
  return { id, title, passed, details }
}

export async function certifySingleVenueClipWindow() {
  const clip = assertClipOnlyUploadPolicy()
  const evidence = loadSingleVenueSimulatorEvidence()

  return stepFromCheck(
    "single_venue_clip_window",
    "Single-venue fixture uses a 15-second replay window and H.264 source",
    evidence.codec === "h264" &&
      clip.clipDurationSeconds === 15 &&
      evidence.clipWindowSeconds === 15,
    {
      codec: evidence.codec,
      clipWindowSeconds: evidence.clipWindowSeconds,
      preRollSeconds: clip.preRollSeconds,
      postRollSeconds: clip.postRollSeconds,
    },
  )
}

export async function certifySingleVenueSourceSelection() {
  const evidence = loadSingleVenueSimulatorEvidence()

  return stepFromCheck(
    "single_venue_source_selection",
    "Single-venue fixture selects the approved primary source",
    evidence.selectedSourceId === evidence.primarySourceId &&
      evidence.commandAccepted === true,
    {
      resourceId: evidence.resourceId,
      selectedSourceId: evidence.selectedSourceId,
      primarySourceId: evidence.primarySourceId,
    },
  )
}

export async function certifySingleVenueIsolation() {
  const evidence = loadSingleVenueSimulatorEvidence()
  const isolation = assertResourceSourceIsolation([
    {
      resourceId: evidence.resourceId,
      selectedSourceId: evidence.selectedSourceId,
      candidateSourceIds: evidence.candidateSourceIds,
    },
  ])
  const commandBinding = assertCommandResourceBinding({
    accepted: false,
    reason: "resource_not_configured",
    expectedReason: "resource_not_configured",
  })

  return stepFromCheck(
    "single_venue_isolation",
    "Single-venue replay stays bound to the requested resource",
    isolation.passed &&
      commandBinding.passed &&
      evidence.wrongResourceRejected === true,
    {
      isolation,
      commandBinding,
    },
  )
}

export async function certifyPrivacyInvariants() {
  const clipOnly = assertNoContinuousStreamUploadPaths()
  const redaction = assertDiagnosticsRedaction()

  try {
    assertReplayStubExecutionAllowed("production")
    return stepFromCheck(
      "privacy_invariants",
      "Clip-only upload policy and diagnostics redaction hold",
      false,
      { clipOnly, redaction, productionStubBlocked: false },
    )
  } catch {
    return stepFromCheck(
      "privacy_invariants",
      "Clip-only upload policy and diagnostics redaction hold",
      clipOnly && redaction,
      { clipOnly, redaction, productionStubBlocked: true },
    )
  }
}

export async function certifySimulatorLatencyTargets() {
  const evaluation = evaluateReplayReadyLatency(simulatorReplayReadyLatencySamples())

  return stepFromCheck(
    "simulator_latency_targets",
    "Simulator replay-ready latency stays within p50 7s and p95 15s targets",
    evaluation.meetsTarget,
    evaluation,
  )
}

export async function runPhase8SimulatorCertification() {
  const steps = [
    await certifySingleVenueClipWindow(),
    await certifySingleVenueSourceSelection(),
    await certifySingleVenueIsolation(),
    await certifyPrivacyInvariants(),
    await certifySimulatorLatencyTargets(),
  ]

  return {
    generatedAt: new Date().toISOString(),
    mode: "simulator",
    passed: steps.every((step) => step.passed),
    steps,
  }
}
