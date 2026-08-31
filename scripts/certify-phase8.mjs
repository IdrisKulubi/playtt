#!/usr/bin/env node
import { runPhase8SimulatorCertification } from "../src/server/replays/phase8/certification.mjs"

const report = await runPhase8SimulatorCertification()

for (const step of report.steps) {
  const marker = step.passed ? "PASS" : "FAIL"
  console.log(`[${marker}] ${step.title}`)
}

console.log("")
console.log(
  report.passed
    ? "Phase 8 simulator certification passed."
    : "Phase 8 simulator certification failed.",
)
console.log(`Mode: ${report.mode}`)
console.log(`Generated: ${report.generatedAt}`)
console.log("")
console.log(
  "Physical single-venue pilot still requires docs/operations/certification/venue-edge-single-venue-pilot.md",
)

process.exit(report.passed ? 0 : 1)
