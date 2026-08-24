export type DeploymentEnvironment =
  | "development"
  | "preview"
  | "staging"
  | "production"
  | "unknown"

export type IsolationCheckStatus = "pass" | "warn" | "fail" | "info"

export interface IsolationCheck {
  key: string
  label: string
  status: IsolationCheckStatus
  summary: string
  runbookPath?: string
}

export interface CredentialFingerprint {
  key: string
  label: string
  fingerprint: string | null
  configured: boolean
}

export interface EnvironmentProfile {
  environment: DeploymentEnvironment
  vercelEnv: string | null
  nodeEnv: string
  commit: string | null
  mediaStoreDriver: string
}

export interface RecoveryObjective {
  key: string
  label: string
  target: string
  measurement: string
  runbookPath: string
}

export interface EnvironmentOperationsReport {
  generatedAt: string
  status: "ok" | "warn" | "fail"
  profile: EnvironmentProfile
  checks: IsolationCheck[]
  fingerprints: CredentialFingerprint[]
  recoveryObjectives: RecoveryObjective[]
}

export const RECOVERY_OBJECTIVES: RecoveryObjective[] = [
  {
    key: "database_rpo",
    label: "Database RPO",
    target: "≤ 24 hours",
    measurement: "Neon point-in-time recovery window",
    runbookPath: "docs/operations/runbooks/database-restore.md",
  },
  {
    key: "database_rto",
    label: "Database RTO",
    target: "≤ 4 hours",
    measurement: "Restore branch + migrate + smoke suite",
    runbookPath: "docs/operations/runbooks/database-restore.md",
  },
  {
    key: "r2_rpo",
    label: "R2 object durability",
    target: "No object loss on provider outage",
    measurement: "Replay assets remain addressable after recovery",
    runbookPath: "docs/operations/runbooks/infrastructure-r2.md",
  },
  {
    key: "secret_rotation_rto",
    label: "Secret rotation RTO",
    target: "≤ 1 hour",
    measurement: "Rotate, redeploy, and re-probe all affected services",
    runbookPath: "docs/operations/runbooks/secret-rotation.md",
  },
  {
    key: "migration_rehearsal",
    label: "Migration rehearsal",
    target: "Before every production rollout",
    measurement: "Empty clone + current clone replay fingerprints match",
    runbookPath: "docs/operations/runbooks/migration-rehearsal.md",
  },
]
