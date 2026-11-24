"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import {
  GroupedSection,
  LargeTitle,
  SegmentedControl,
  textActionClass,
} from "@/components/admin/admin-grouped"
import { runbookHref } from "@/components/admin/runbook-href"
import type {
  CertificationGate,
  PhaseCertificationReport,
} from "@/server/operations/certification-types"

type Phase = PhaseCertificationReport["phase"]

const PHASE_META: Record<Phase, { id: string; label: string; title: string; blurb: string }> = {
  P5: { id: "phase-p5", label: "Phase 5", title: "Access rollout", blurb: "Smart locks, gateways and booking access codes." },
  P7: { id: "phase-p7", label: "Phase 7", title: "Operations readiness", blurb: "Monitoring, alerts and venue runbooks." },
  P8: { id: "phase-p8", label: "Phase 8", title: "VenueEdge replays", blurb: "Venue PC, cameras and replay capture." },
}

const STATUS_LABEL: Record<CertificationGate["status"], string> = {
  pass: "Passed",
  blocked: "Blocked",
  pending: "Not done",
  manual: "Needs sign-off",
}

const KIND_LABEL: Record<CertificationGate["kind"], string> = {
  software: "Software",
  hardware: "Hardware",
  process: "Process",
}

function phaseState(report: PhaseCertificationReport) {
  const passed = report.gates.filter((gate) => gate.status === "pass").length
  const blocked = report.gates.filter((gate) => gate.status === "blocked").length
  const label = report.status === "ready" ? "Ready" : report.status === "blocked" || blocked > 0 ? "Blocked" : "In progress"
  return { passed, blocked, total: report.gates.length, label }
}

function GateRow({ gate }: { gate: CertificationGate }) {
  const [copied, setCopied] = useState(false)
  const paths = [gate.evidencePath, gate.runbookPath].filter(Boolean) as string[]
  return (
    <li className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-4">
        <p className="min-w-0 text-[15px] font-medium">{gate.title}</p>
        <span className={`shrink-0 text-[13px] ${gate.status === "blocked" ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
          {STATUS_LABEL[gate.status]}
        </span>
      </div>
      <p className="mt-0.5 text-[15px] leading-snug text-muted-foreground">{gate.summary}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
        <span className="text-muted-foreground">{KIND_LABEL[gate.kind]}</span>
        {gate.runbookPath ? (
          <Link href={runbookHref(gate.runbookPath)} target="_blank" rel="noreferrer" className={textActionClass}>
            Checklist
          </Link>
        ) : null}
        {paths.length > 0 ? (
          <button
            type="button"
            className={textActionClass}
            onClick={() => {
              void navigator.clipboard?.writeText(paths.join("\n")).then(() => {
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1500)
              })
            }}
          >
            {copied ? "Copied" : "Copy file paths"}
          </button>
        ) : null}
      </div>
    </li>
  )
}

export function AdminCertificationDashboard({ reports }: { reports: PhaseCertificationReport[] }) {
  const firstOpen = reports.find((report) => report.status !== "ready") ?? reports[0]
  const [active, setActive] = useState<Phase>(firstOpen?.phase ?? "P8")

  // Keep the old #phase-pN links working.
  useEffect(() => {
    function syncFromHash() {
      const match = reports.find((report) => `#${PHASE_META[report.phase].id}` === window.location.hash)
      if (match) setActive(match.phase)
    }
    syncFromHash()
    window.addEventListener("hashchange", syncFromHash)
    return () => window.removeEventListener("hashchange", syncFromHash)
  }, [reports])

  function select(phase: Phase) {
    setActive(phase)
    window.history.replaceState(null, "", `#${PHASE_META[phase].id}`)
  }

  const report = reports.find((item) => item.phase === active) ?? reports[0]
  if (!report) {
    return <p className="px-4 text-[15px] text-muted-foreground">No certification reports available.</p>
  }

  const meta = PHASE_META[report.phase]
  const state = phaseState(report)
  const percent = state.total > 0 ? Math.round((state.passed / state.total) * 100) : 0
  const blocked = report.gates.filter((gate) => gate.status === "blocked")
  const todo = report.gates.filter((gate) => gate.status === "pending" || gate.status === "manual")
  const passed = report.gates.filter((gate) => gate.status === "pass")

  return (
    <div className="space-y-8">
      <div className="px-4">
        <SegmentedControl<Phase>
          label="Certification phases"
          value={report.phase}
          onChange={select}
          options={reports.map((item) => {
            const itemState = phaseState(item)
            return { value: item.phase, label: `${PHASE_META[item.phase].label} · ${itemState.label}` }
          })}
        />
      </div>

      <div id={meta.id} className="scroll-mt-28 space-y-3">
        <LargeTitle title={meta.title} subtitle={`${state.passed} of ${state.total} checks passed · ${state.label}`} />
        <div className="px-4">
          <div className="h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-foreground/70 transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {meta.blurb} Software checks run automatically; hardware and process checks need pilot-venue evidence and a sign-off.
          </p>
        </div>
      </div>

      {blocked.length > 0 ? (
        <GroupedSection header="Blocked" headerAccessory={blocked.length}>
          {blocked.map((gate) => <GateRow key={gate.id} gate={gate} />)}
        </GroupedSection>
      ) : null}

      {todo.length > 0 ? (
        <GroupedSection header="Still to do" headerAccessory={todo.length}>
          {todo.map((gate) => <GateRow key={gate.id} gate={gate} />)}
        </GroupedSection>
      ) : null}

      {passed.length > 0 ? (
        <details open={blocked.length + todo.length === 0} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 pb-1.5 text-[13px] tracking-[0.01em] text-muted-foreground uppercase">
            <span>Passed</span>
            <span className="normal-case">
              {passed.length} · <span className="text-primary group-open:hidden">Show</span>
              <span className="hidden text-primary group-open:inline">Hide</span>
            </span>
          </summary>
          <ul className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/60 [&>li+li]:border-t [&>li+li]:border-border/60">
            {passed.map((gate) => <GateRow key={gate.id} gate={gate} />)}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
