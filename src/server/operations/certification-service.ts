import { authorize } from "../tenancy/authorize-context.mjs"
import type { TenantContext } from "../tenancy/types"
import {
  PHASE5_HARDWARE_GATES,
  PHASE5_SOFTWARE_GATES,
  PHASE7_HARDWARE_GATES,
  PHASE7_SOFTWARE_GATES,
} from "./certification-catalog.ts"
import { evaluateEnvironmentIsolation } from "./environment-isolation.ts"
import type { PhaseCertificationReport } from "./certification-types.ts"

export async function getPhase7CertificationReport(context: TenantContext) {
  authorize(context, "venue.read")
  return buildPhase7CertificationReport()
}

export async function getPhase5CertificationReport(context: TenantContext) {
  authorize(context, "venue.read")
  return buildPhase5CertificationReport()
}

export function buildPhase5CertificationReport(): PhaseCertificationReport {
  const gates = [...PHASE5_SOFTWARE_GATES, ...PHASE5_HARDWARE_GATES]
  const softwareGates = gates.filter((gate) => gate.kind === "software")
  const softwarePassCount = softwareGates.filter(
    (gate) => gate.status === "pass",
  ).length
  const hardwareManualCount = gates.filter(
    (gate) => gate.kind === "hardware" || gate.kind === "process",
  ).length

  const status =
    softwarePassCount === softwareGates.length ? "in_progress" : "blocked"

  return {
    generatedAt: new Date().toISOString(),
    phase: "P5",
    status,
    softwarePassCount,
    softwareTotal: softwareGates.length,
    hardwareManualCount,
    gates,
  }
}

export function buildPhase7CertificationReport(): PhaseCertificationReport {
  const environment = evaluateEnvironmentIsolation()

  const gates = [
    ...PHASE7_SOFTWARE_GATES.map((gate) => {
      if (gate.id !== "p7_environment_isolation") {
        return gate
      }

      return {
        ...gate,
        summary: `Current deployment isolation status: ${environment.status}.`,
        status:
          environment.status === "fail"
            ? ("pending" as const)
            : ("pass" as const),
      }
    }),
    ...PHASE7_HARDWARE_GATES,
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
