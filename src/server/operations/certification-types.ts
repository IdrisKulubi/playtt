export type CertificationGateKind = "software" | "hardware" | "process"

export type CertificationGateStatus =
  | "pass"
  | "pending"
  | "manual"
  | "blocked"

export interface CertificationGate {
  id: string
  title: string
  kind: CertificationGateKind
  status: CertificationGateStatus
  summary: string
  evidencePath: string | null
  runbookPath: string | null
}

export interface PhaseCertificationReport {
  generatedAt: string
  phase: "P7"
  status: "ready" | "in_progress" | "blocked"
  softwarePassCount: number
  softwareTotal: number
  hardwareManualCount: number
  gates: CertificationGate[]
}
