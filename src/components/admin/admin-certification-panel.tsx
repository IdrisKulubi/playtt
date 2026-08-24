import { Badge } from "@/components/ui/badge"
import type {
  CertificationGate,
  PhaseCertificationReport,
} from "@/server/operations/certification-types"

function gateStatusLabel(status: CertificationGate["status"]) {
  switch (status) {
    case "pass":
      return "Pass"
    case "pending":
      return "Pending"
    case "manual":
      return "Manual"
    case "blocked":
      return "Blocked"
  }
}

function gateStatusVariant(status: CertificationGate["status"]) {
  switch (status) {
    case "pass":
      return "default" as const
    case "pending":
      return "outline" as const
    case "manual":
      return "secondary" as const
    case "blocked":
      return "destructive" as const
  }
}

function CertificationGateRow({ gate }: { gate: CertificationGate }) {
  return (
    <div className="rounded-xl border border-border/70 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">{gate.title}</p>
        <Badge variant="outline">{gate.kind}</Badge>
        <Badge variant={gateStatusVariant(gate.status)}>
          {gateStatusLabel(gate.status)}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{gate.summary}</p>
      {gate.evidencePath ? (
        <code className="mt-2 block rounded bg-muted px-2 py-1 text-xs">
          {gate.evidencePath}
        </code>
      ) : null}
      {gate.runbookPath ? (
        <code className="mt-2 block rounded bg-muted px-2 py-1 text-xs">
          {gate.runbookPath}
        </code>
      ) : null}
    </div>
  )
}

export function AdminCertificationPanel({
  report,
}: {
  report: PhaseCertificationReport
}) {
  const softwareGates = report.gates.filter((gate) => gate.kind === "software")
  const hardwareGates = report.gates.filter((gate) => gate.kind === "hardware")

  return (
    <div className="space-y-6">
      <section className="admin-dashboard-card space-y-2">
        <p className="text-sm text-muted-foreground">Phase 7 certification</p>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-[-0.03em] capitalize">
            {report.status.replace("_", " ")}
          </h2>
          <Badge variant={report.status === "ready" ? "default" : "outline"}>
            {report.softwarePassCount}/{report.softwareTotal} software gates
          </Badge>
          <Badge variant="secondary">
            {report.hardwareManualCount} hardware/process gates
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Software deliverables are automated. Hardware acceptance and rollout
          gates require pilot venue evidence.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold">Software gates</h3>
        <div className="grid gap-3">
          {softwareGates.map((gate) => (
            <CertificationGateRow key={gate.id} gate={gate} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold">Hardware and rollout gates</h3>
        <div className="grid gap-3">
          {hardwareGates.map((gate) => (
            <CertificationGateRow key={gate.id} gate={gate} />
          ))}
        </div>
      </section>
    </div>
  )
}
