import { Badge } from "@/components/ui/badge"
import type {
  CredentialFingerprint,
  EnvironmentOperationsReport,
  IsolationCheck,
  IsolationCheckStatus,
  RecoveryObjective,
} from "@/server/operations/environment-types"

function statusLabel(status: IsolationCheckStatus | EnvironmentOperationsReport["status"]) {
  switch (status) {
    case "pass":
    case "ok":
      return "Pass"
    case "warn":
      return "Warning"
    case "fail":
      return "Fail"
    case "info":
      return "Info"
  }
}

function statusVariant(status: IsolationCheckStatus | EnvironmentOperationsReport["status"]) {
  switch (status) {
    case "pass":
    case "ok":
      return "default" as const
    case "warn":
      return "outline" as const
    case "fail":
      return "destructive" as const
    case "info":
      return "secondary" as const
  }
}

function StatusBadge({
  status,
}: {
  status: IsolationCheckStatus | EnvironmentOperationsReport["status"]
}) {
  return <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
}

function IsolationCheckRow({ check }: { check: IsolationCheck }) {
  return (
    <div className="rounded-xl border border-border/70 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">{check.label}</p>
        <StatusBadge status={check.status} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{check.summary}</p>
      {check.runbookPath ? (
        <code className="mt-2 block rounded bg-muted px-2 py-1 text-xs">
          {check.runbookPath}
        </code>
      ) : null}
    </div>
  )
}

function FingerprintRow({ entry }: { entry: CredentialFingerprint }) {
  return (
    <div className="rounded-xl border border-border/70 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">{entry.label}</p>
        <Badge variant={entry.configured ? "outline" : "secondary"}>
          {entry.configured ? "Configured" : "Missing"}
        </Badge>
      </div>
      <p className="mt-1 font-mono text-sm text-muted-foreground">
        {entry.fingerprint ?? "—"}
      </p>
    </div>
  )
}

function RecoveryObjectiveRow({ objective }: { objective: RecoveryObjective }) {
  return (
    <div className="rounded-xl border border-border/70 px-3 py-2.5">
      <p className="text-sm font-medium">{objective.label}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Target: {objective.target}
      </p>
      <p className="text-sm text-muted-foreground">
        Measurement: {objective.measurement}
      </p>
      <code className="mt-2 block rounded bg-muted px-2 py-1 text-xs">
        {objective.runbookPath}
      </code>
    </div>
  )
}

export function AdminEnvironmentPanel({
  report,
}: {
  report: EnvironmentOperationsReport
}) {
  return (
    <div className="space-y-6">
      <div className="admin-dashboard-card flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Environment isolation</p>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-[-0.03em] capitalize">
              {report.profile.environment}
            </h2>
            <StatusBadge status={report.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            NODE_ENV={report.profile.nodeEnv}
            {report.profile.vercelEnv ? ` · VERCEL_ENV=${report.profile.vercelEnv}` : ""}
            {report.profile.commit ? ` · ${report.profile.commit.slice(0, 7)}` : ""}
            {` · media=${report.profile.mediaStoreDriver}`}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Updated {new Date(report.generatedAt).toLocaleString()}
        </p>
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold">Isolation checks</h3>
          <p className="text-sm text-muted-foreground">
            Verify this runtime is not sharing production database, storage, or
            payment credentials.
          </p>
        </div>
        <div className="grid gap-3">
          {report.checks.map((check) => (
            <IsolationCheckRow key={check.key} check={check} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold">Credential fingerprints</h3>
          <p className="text-sm text-muted-foreground">
            Hashed identifiers for cross-environment comparison. Secrets are
            never shown.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {report.fingerprints.map((entry) => (
            <FingerprintRow key={entry.key} entry={entry} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold">Recovery objectives</h3>
          <p className="text-sm text-muted-foreground">
            Approved RTO/RPO targets and the runbooks used to rehearse recovery.
          </p>
        </div>
        <div className="grid gap-3">
          {report.recoveryObjectives.map((objective) => (
            <RecoveryObjectiveRow key={objective.key} objective={objective} />
          ))}
        </div>
      </section>
    </div>
  )
}
