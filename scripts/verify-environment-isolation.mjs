import process from "node:process"

import {
  evaluateEnvironmentIsolation,
  isolationCheckHasFailure,
  isolationChecksForCi,
} from "../src/server/operations/environment-isolation.ts"

const report = evaluateEnvironmentIsolation(process.env)
const actionableChecks = isolationChecksForCi(report)

console.log(`Environment: ${report.profile.environment}`)
console.log(`Status: ${report.status}`)

for (const check of actionableChecks) {
  console.log(`[${check.status.toUpperCase()}] ${check.label}: ${check.summary}`)
}

if (isolationCheckHasFailure(actionableChecks)) {
  process.exitCode = 1
}
