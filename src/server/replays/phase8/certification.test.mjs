import assert from "node:assert/strict"
import test from "node:test"

import { runPhase8SimulatorCertification } from "./certification.mjs"
import { evaluateReplayReadyLatency, simulatorReplayReadyLatencySamples } from "./latency.ts"
import {
  assertClipOnlyUploadPolicy,
  assertDiagnosticsRedaction,
  assertNoContinuousStreamUploadPaths,
} from "./privacy-invariants.ts"

test("phase8 simulator certification passes", async () => {
  const report = await runPhase8SimulatorCertification()

  assert.equal(report.mode, "simulator")
  assert.equal(report.passed, true)
  assert.ok(report.steps.length >= 5)
  assert.ok(report.steps.every((step) => step.passed))
})

test("phase8 privacy invariants hold", () => {
  const clip = assertClipOnlyUploadPolicy()
  assert.equal(clip.clipDurationSeconds, 15)
  assert.equal(assertDiagnosticsRedaction(), true)
  assert.equal(assertNoContinuousStreamUploadPaths(), true)
})

test("phase8 simulator latency targets stay within bounds", () => {
  const evaluation = evaluateReplayReadyLatency(simulatorReplayReadyLatencySamples())
  assert.equal(evaluation.meetsTarget, true)
  assert.ok(evaluation.p50Ms <= evaluation.targetP50Ms)
  assert.ok(evaluation.p95Ms <= evaluation.targetP95Ms)
})
