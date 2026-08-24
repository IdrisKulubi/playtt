import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import { buildPhase7CertificationReport } from "../../src/server/operations/certification-service.ts"
import {
  evaluateAccessDimension,
  evaluateNetworkDimension,
} from "../../src/server/operations/health-status.ts"

const repoRoot = join(import.meta.dirname, "..", "..")

test("buildPhase7CertificationReport marks software gates and manual hardware gates", () => {
  const report = buildPhase7CertificationReport()

  assert.equal(report.phase, "P7")
  assert.ok(report.softwareTotal >= 6)
  assert.ok(report.hardwareManualCount >= 3)
  assert.ok(report.gates.some((gate) => gate.id === "p7_external_paging"))
  assert.ok(report.gates.some((gate) => gate.status === "manual"))
})

test("access and network evaluators use venue signals", () => {
  assert.equal(
    evaluateAccessDimension({
      accessPointCount: 0,
      failedCredentialCount: 0,
      pendingCredentialCount: 0,
    }).status,
    "not_configured",
  )
  assert.equal(
    evaluateAccessDimension({
      accessPointCount: 2,
      failedCredentialCount: 1,
      pendingCredentialCount: 0,
    }).status,
    "down",
  )
  assert.equal(
    evaluateNetworkDimension({ health: "offline" }).status,
    "down",
  )
})

test("phase 7 admin routes and scripts are present", () => {
  const sidebar = readFileSync(
    join(repoRoot, "src", "components", "admin", "admin-sidebar.tsx"),
    "utf8",
  )

  assert.match(sidebar, /\/admin\/certification/)
  assert.match(sidebar, /\/admin\/environment/)

  const packageJson = JSON.parse(
    readFileSync(join(repoRoot, "package.json"), "utf8"),
  )

  assert.match(packageJson.scripts["test:phase7"], /phase7-certification/)
  assert.match(packageJson.scripts["ops:rehearse-dr"], /rehearse-dr-smoke/)
})
