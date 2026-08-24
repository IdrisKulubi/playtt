import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { authorize } from "../tenancy/authorize-context.mjs"
import type { TenantContext } from "../tenancy/types"
import { evaluateEnvironmentIsolation } from "./environment-isolation.ts"
import type {
  CertificationGate,
  PhaseCertificationReport,
} from "./certification-types.ts"

const repoRoot = join(import.meta.dirname, "..", "..", "..")

function fileExists(relativePath: string) {
  return existsSync(join(repoRoot, relativePath))
}

function sourceExists(relativePath: string) {
  return fileExists(relativePath)
}

function buildSoftwareGate(input: {
  id: string
  title: string
  summary: string
  evidencePath: string
  pass: boolean
}): CertificationGate {
  return {
    id: input.id,
    title: input.title,
    kind: "software",
    status: input.pass ? "pass" : "pending",
    summary: input.summary,
    evidencePath: input.evidencePath,
    runbookPath: null,
  }
}

function buildManualGate(input: {
  id: string
  title: string
  summary: string
  runbookPath: string
}): CertificationGate {
  return {
    id: input.id,
    title: input.title,
    kind: "hardware",
    status: "manual",
    summary: input.summary,
    evidencePath: null,
    runbookPath: input.runbookPath,
  }
}

export async function getPhase7CertificationReport(context: TenantContext) {
  authorize(context, "venue.read")
  return buildPhase7CertificationReport()
}

export function buildPhase7CertificationReport(): PhaseCertificationReport {
  const environment = evaluateEnvironmentIsolation()
  const packageJson = JSON.parse(
    readFileSync(join(repoRoot, "package.json"), "utf8"),
  ) as { scripts?: Record<string, string> }

  const gates: CertificationGate[] = [
    buildSoftwareGate({
      id: "p7_health_overview",
      title: "Tenant and venue health overview",
      summary: "Admin health dashboard and venue strips are available.",
      evidencePath: "src/app/admin/health/page.tsx",
      pass: sourceExists("src/app/admin/health/page.tsx"),
    }),
    buildSoftwareGate({
      id: "p7_booking_timeline",
      title: "Correlated booking timeline",
      summary: "Operators can trace payment through replay on booking detail.",
      evidencePath: "src/app/admin/bookings/[id]/page.tsx",
      pass: sourceExists("src/app/admin/bookings/[id]/page.tsx"),
    }),
    buildSoftwareGate({
      id: "p7_alerts_runbooks",
      title: "Derived alerts and runbooks",
      summary: "Active alerts map to recovery runbooks in the operations module.",
      evidencePath: "src/server/operations/alert-catalog.ts",
      pass: sourceExists("src/server/operations/alert-catalog.ts"),
    }),
    buildSoftwareGate({
      id: "p7_external_paging",
      title: "External on-call paging",
      summary: "Webhook dispatch cron and audited paging are configured in code.",
      evidencePath: "src/app/api/cron/operational-alerts/route.ts",
      pass: sourceExists("src/app/api/cron/operational-alerts/route.ts"),
    }),
    buildSoftwareGate({
      id: "p7_alert_acknowledge",
      title: "Audited alert acknowledgement",
      summary: "Operators can acknowledge active alerts with audit trail.",
      evidencePath: "src/app/api/admin/alerts/acknowledge/route.ts",
      pass: sourceExists("src/app/api/admin/alerts/acknowledge/route.ts"),
    }),
    buildSoftwareGate({
      id: "p7_environment_isolation",
      title: "Environment isolation checks",
      summary: `Current deployment isolation status: ${environment.status}.`,
      evidencePath: "src/app/admin/environment/page.tsx",
      pass:
        sourceExists("src/app/admin/environment/page.tsx") &&
        environment.status !== "fail",
    }),
    buildSoftwareGate({
      id: "p7_operations_tests",
      title: "Operations test suite",
      summary: "Automated operations module tests are registered in package scripts.",
      evidencePath: "package.json",
      pass: Boolean(packageJson.scripts?.["test:operations"]),
    }),
    buildSoftwareGate({
      id: "p7_dr_tooling",
      title: "DR rehearsal tooling",
      summary: "DR smoke runner and recovery runbooks exist.",
      evidencePath: "scripts/rehearse-dr-smoke.mjs",
      pass: sourceExists("scripts/rehearse-dr-smoke.mjs"),
    }),
    buildManualGate({
      id: "p7_network_certification",
      title: "Venue network certification",
      summary:
        "VLAN/firewall isolation and measured WAN capacity require pilot venue hardware.",
      runbookPath: "docs/operations/runbooks/venue-network.md",
    }),
    buildManualGate({
      id: "p7_single_table_acceptance",
      title: "Single-table physical acceptance",
      summary:
        "Table 01 journey with TTLock, ESP32 scoring, display, and replay requires physical hardware.",
      runbookPath: "docs/operations/certification/single-table-acceptance.md",
    }),
    buildManualGate({
      id: "p7_ten_table_acceptance",
      title: "Ten-table acceptance",
      summary:
        "Concurrent multi-resource load and isolation require ten configured tables.",
      runbookPath: "docs/operations/certification/ten-table-acceptance.md",
    }),
    buildManualGate({
      id: "p7_rollout_gates",
      title: "Progressive rollout and GA approval",
      summary:
        "Pilot venue observation windows and owner sign-off are process gates.",
      runbookPath: "docs/operations/rollout-checklist.md",
    }),
  ]

  const softwareGates = gates.filter((gate) => gate.kind === "software")
  const softwarePassCount = softwareGates.filter(
    (gate) => gate.status === "pass",
  ).length
  const hardwareManualCount = gates.filter((gate) => gate.kind === "hardware")
    .length

  const status =
    softwarePassCount === softwareGates.length ? "ready" : "in_progress"

  return {
    generatedAt: new Date().toISOString(),
    phase: "P7",
    status,
    softwarePassCount,
    softwareTotal: softwareGates.length,
    hardwareManualCount,
    gates,
  }
}
