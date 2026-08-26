#!/usr/bin/env node
import { runPhase5SimulatorCertification } from "../src/server/access/phase5-certification.mjs"

const report = await runPhase5SimulatorCertification()

for (const step of report.steps) {
  const marker = step.passed ? "PASS" : "FAIL"
  console.log(`[${marker}] ${step.title}`)
}

console.log("")
console.log(
  report.passed
    ? "Phase 5 simulator certification passed."
    : "Phase 5 simulator certification failed.",
)
console.log(`Mode: ${report.mode}`)
console.log(`Generated: ${report.generatedAt}`)
console.log("")
console.log(
  "Physical keypad acceptance still requires docs/operations/certification/ttlock-keypad-acceptance.md",
)

process.exit(report.passed ? 0 : 1)
