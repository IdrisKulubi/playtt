"use client"

import Link from "next/link"
import { useState } from "react"

import {
  GroupedSection,
  LargeTitle,
  ValueRow,
  textActionClass,
} from "@/components/admin/admin-grouped"
import { runbookHref } from "@/components/admin/runbook-href"
import type {
  DeploymentEnvironment,
  EnvironmentOperationsReport,
  IsolationCheckStatus,
} from "@/server/operations/environment-types"

const ENV_LABEL: Record<DeploymentEnvironment, string> = {
  production: "Production",
  staging: "Staging",
  preview: "Preview",
  development: "Development",
  unknown: "Unknown environment",
}

const CHECK_LABEL: Record<IsolationCheckStatus, string> = {
  fail: "Failed",
  warn: "Review",
  info: "Info",
  pass: "Passed",
}
const CHECK_ORDER: Record<IsolationCheckStatus, number> = { fail: 0, warn: 1, info: 2, pass: 3 }

// Fixed locale and zone so the server render and the browser agree.
const updatedFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Nairobi",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
})

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  function copy(value: string) {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(value)
      window.setTimeout(() => setCopied(null), 1500)
    })
  }
  return { copied, copy }
}

export function AdminEnvironmentPanel({ report }: { report: EnvironmentOperationsReport }) {
  const { copied, copy } = useCopy()
  const failed = report.checks.filter((check) => check.status === "fail").length
  const warned = report.checks.filter((check) => check.status === "warn").length
  const passed = report.checks.filter((check) => check.status === "pass").length
  const checks = [...report.checks].sort((a, b) => CHECK_ORDER[a.status] - CHECK_ORDER[b.status])
  const fingerprints = [...report.fingerprints].sort((a, b) => Number(a.configured) - Number(b.configured))
  const commit = report.profile.commit

  const health =
    failed > 0
      ? `${failed} isolation check${failed === 1 ? "" : "s"} failed`
      : warned > 0
        ? `${warned} check${warned === 1 ? "" : "s"} to review`
        : "Isolated from other environments"

  return (
    <div className="space-y-8">
      <LargeTitle
        title={ENV_LABEL[report.profile.environment] ?? ENV_LABEL.unknown}
        subtitle={`${health} · checked ${updatedFormat.format(new Date(report.generatedAt))}`}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          <GroupedSection header="Deployment" footer="Reload the page to re-run every check.">
            <ValueRow label="Vercel environment" value={report.profile.vercelEnv ?? "Not on Vercel"} />
            <ValueRow label="Node environment" value={report.profile.nodeEnv} />
            <ValueRow label="Media storage" value={report.profile.mediaStoreDriver} />
            <li className="flex items-baseline justify-between gap-4 px-4 py-3 text-[15px]">
              <span>Commit</span>
              <span className="flex items-baseline gap-3">
                <span className="font-mono text-[13px] text-muted-foreground">{commit ? commit.slice(0, 7) : "—"}</span>
                {commit ? (
                  <button type="button" className={textActionClass} onClick={() => copy(commit)}>
                    {copied === commit ? "Copied" : "Copy"}
                  </button>
                ) : null}
              </span>
            </li>
          </GroupedSection>

          <GroupedSection
            header="Isolation checks"
            headerAccessory={`${passed} of ${report.checks.length} passed`}
            footer="Confirms this copy isn't sharing production's database, storage or payment keys."
          >
            {checks.map((check) => (
              <li key={check.key} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[15px]">{check.label}</span>
                  <span
                    className={`shrink-0 text-[13px] ${
                      check.status === "fail" || check.status === "warn" ? "font-semibold text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {CHECK_LABEL[check.status]}
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{check.summary}</p>
                {check.runbookPath ? (
                  <Link href={runbookHref(check.runbookPath)} target="_blank" rel="noreferrer" className={`mt-1 inline-block ${textActionClass}`}>
                    Runbook
                  </Link>
                ) : null}
              </li>
            ))}
          </GroupedSection>
        </div>

        <div className="space-y-8">
          <GroupedSection header="Credentials" footer="Hashed fingerprints for comparing environments. Secrets are never shown.">
            {fingerprints.map((entry) => (
              <li key={entry.key} className="flex items-baseline justify-between gap-4 px-4 py-3">
                <span className="min-w-0 truncate text-[15px]">{entry.label}</span>
                {entry.configured && entry.fingerprint ? (
                  <button
                    type="button"
                    onClick={() => copy(entry.fingerprint as string)}
                    className="min-w-0 truncate font-mono text-[13px] text-muted-foreground transition-opacity active:opacity-50"
                    title="Copy fingerprint"
                  >
                    {copied === entry.fingerprint ? "Copied" : entry.fingerprint}
                  </button>
                ) : (
                  <span className="shrink-0 text-[13px] font-semibold">Not set</span>
                )}
              </li>
            ))}
          </GroupedSection>

          <GroupedSection
            header="Recovery targets"
            footer="RPO is how much data we can afford to lose; RTO is how fast we must be back up."
          >
            {report.recoveryObjectives.map((objective) => (
              <li key={objective.key} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-4 text-[15px]">
                  <span>{objective.label}</span>
                  <span className="text-muted-foreground">{objective.target}</span>
                </div>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{objective.measurement}</p>
                <Link href={runbookHref(objective.runbookPath)} target="_blank" rel="noreferrer" className={`mt-1 inline-block ${textActionClass}`}>
                  Runbook
                </Link>
              </li>
            ))}
          </GroupedSection>
        </div>
      </div>
    </div>
  )
}
