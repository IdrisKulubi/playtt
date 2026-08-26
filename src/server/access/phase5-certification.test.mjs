import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { runPhase5SimulatorCertification } from "./phase5-certification.mjs"
import { buildPhase5CertificationReport } from "../operations/certification-service.ts"

const repoRoot = join(import.meta.dirname, "..", "..", "..")

test("Phase 5 simulator certification completes keypad, two-venue, and resource-change flows", async () => {
  const report = await runPhase5SimulatorCertification()

  assert.equal(report.passed, true)
  assert.equal(report.steps.length, 3)
  assert.ok(report.steps.some((step) => step.id === "keypad_window_lifecycle"))
  assert.ok(report.steps.some((step) => step.id === "two_venue_door_isolation"))
})

test("buildPhase5CertificationReport marks software gates and manual hardware gates", () => {
  const report = buildPhase5CertificationReport()

  assert.equal(report.phase, "P5")
  assert.ok(report.softwareTotal >= 2)
  assert.ok(report.hardwareManualCount >= 2)
  assert.ok(report.gates.some((gate) => gate.id === "p5_simulator_certification"))
  assert.ok(report.gates.some((gate) => gate.status === "manual"))
})

test("phase 5 certification scripts and docs are present", () => {
  const packageJson = JSON.parse(
    readFileSync(join(repoRoot, "package.json"), "utf8"),
  )

  assert.match(packageJson.scripts["certify:phase5"], /certify-phase5-access/)
  assert.match(packageJson.scripts["test:access"], /phase5-certification\.test/)

  for (const doc of [
    "docs/operations/certification/ttlock-keypad-acceptance.md",
    "docs/operations/certification/phase5-two-venue-acceptance.md",
    "docs/operations/certification/phase5-pilot-rollout.md",
  ]) {
    readFileSync(join(repoRoot, doc), "utf8")
  }
})
