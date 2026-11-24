"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CaretRightIcon } from "@phosphor-icons/react"

import {
  GroupedList,
  SectionFooter,
  SectionHeader,
  SegmentedControl,
  textActionClass,
} from "@/components/admin/admin-grouped"
import type { VenueEdgeInstallationFleetView } from "@/server/replays/venue-edge-fleet"

const AUTO_REFRESH_MS = 30_000
// Filters only help once there are enough PCs to scan through.
const FILTER_THRESHOLD = 4

type HealthCheck = { label: string; value: string; problem: boolean }

function formatBytes(value: number) {
  if (value <= 0) return "—"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatAgo(iso: string | null, now: number) {
  if (!iso) return "never"
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  return new Date(iso).toLocaleDateString("en-GB")
}

function buildHealthChecks(installation: VenueEdgeInstallationFleetView, now: number): HealthCheck[] {
  const metrics = installation.heartbeatMetrics
  const online = installation.connectivity === "online"
  const { enabledCameraCount, cameraCount } = installation.reportedTopology.topology
  const issues = installation.sourceHealthRows.filter((row) => row.status !== "healthy" && row.status !== "online").length

  const checks: HealthCheck[] = [
    {
      label: "Connection",
      value: online
        ? `Online, seen ${formatAgo(installation.lastHeartbeatAt, now)}`
        : installation.connectivity === "offline"
          ? `Offline, last seen ${formatAgo(installation.lastHeartbeatAt, now)}`
          : installation.connectivity.replace(/_/g, " "),
      problem: !online,
    },
    {
      label: "Cameras",
      value:
        cameraCount === 0
          ? "None found yet"
          : `${enabledCameraCount} of ${cameraCount} in use${issues > 0 ? `, ${issues} stream warning${issues === 1 ? "" : "s"}` : ""}`,
      problem: enabledCameraCount === 0 || issues > 0,
    },
    {
      label: "Storage",
      value: metrics ? `${formatBytes(metrics.diskUsageBytes)} used${installation.diskPressure ? ", running low" : ""}` : "No data yet",
      problem: installation.diskPressure,
    },
    {
      label: "Replay uploads",
      value: metrics
        ? `${metrics.uploadHealth === "healthy" ? "Healthy" : metrics.uploadHealth}${installation.replayQueueDepth > 0 ? `, ${installation.replayQueueDepth} queued` : ""}`
        : "No data yet",
      problem: Boolean(metrics && metrics.uploadHealth !== "healthy"),
    },
  ]
  if (installation.hostSleepRisk) {
    checks.push({ label: "Power", value: installation.hostSleepRiskReason ?? "PC may go to sleep", problem: true })
  }
  if (installation.reauthRequiredCount > 0) {
    checks.push({ label: "Camera logins", value: `${installation.reauthRequiredCount} need a new password`, problem: true })
  }
  if (installation.topologyDrift.hasDrift) {
    checks.push({ label: "Configuration", value: installation.topologyDrift.summary, problem: true })
  }
  return checks
}

function statusLine(installation: VenueEdgeInstallationFleetView, checks: HealthCheck[]) {
  if (installation.connectivity === "offline") return "Offline"
  if (installation.readiness !== "ready") return "Needs attention"
  const problems = checks.filter((check) => check.problem).length
  return problems > 0 ? `Ready, ${problems} thing${problems === 1 ? "" : "s"} to check` : "Ready"
}

export function NvrFleetPanel({ selectedVenueId, initialInstallations }: { selectedVenueId: string; initialInstallations: VenueEdgeInstallationFleetView[] }) {
  const router = useRouter()
  const [installations, setInstallations] = useState(initialInstallations)
  const [healthFilter, setHealthFilter] = useState("all")
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const showFilters = installations.length >= FILTER_THRESHOLD
  const filtered = useMemo(
    () => installations.filter((item) => healthFilter === "all" || item.connectivity === healthFilter),
    [installations, healthFilter],
  )

  const refreshFleet = useCallback(async (options?: { quiet?: boolean }) => {
    if (!options?.quiet) { setLoading(true); setMessage(null) }
    try {
      const params = new URLSearchParams({ locationId: selectedVenueId })
      const response = await fetch(`/api/operator/venue-edge/installations?${params}`)
      if (!response.ok) { if (!options?.quiet) setMessage("Could not refresh."); return }
      const payload = (await response.json()) as { data?: { installations?: VenueEdgeInstallationFleetView[] } }
      setInstallations(payload.data?.installations ?? [])
      setLastUpdated(Date.now())
    } catch { if (!options?.quiet) setMessage("Could not refresh.") } finally { if (!options?.quiet) setLoading(false) }
  }, [selectedVenueId])

  // Keep status live without the operator pressing Refresh.
  useEffect(() => {
    const refreshTimer = setInterval(() => {
      if (document.visibilityState === "visible") void refreshFleet({ quiet: true })
    }, AUTO_REFRESH_MS)
    const clockTimer = setInterval(() => setNow(Date.now()), 5_000)
    return () => { clearInterval(refreshTimer); clearInterval(clockTimer) }
  }, [refreshFleet])

  async function handleRemoveInstallation(installation: VenueEdgeInstallationFleetView) {
    if (!window.confirm(`Remove ${installation.displayName} from the active fleet? Historical replay and audit records will be preserved.`)) return
    setLoading(true); setMessage(null)
    try {
      const response = await fetch(`/api/operator/venue-edge/installations/${installation.id}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "revoke", reason: "Removed from active VenueEdge fleet" }) })
      if (!response.ok) { const error = (await response.json()) as { message?: string }; return setMessage(error.message ?? "Could not remove installation.") }
      await refreshFleet({ quiet: true })
      router.refresh()
      setMessage(`${installation.displayName} was removed. Historical records were preserved.`)
    } catch { setMessage("Could not remove installation.") } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 px-4">
        <p className="text-[13px] text-muted-foreground" suppressHydrationWarning>
          Updated {formatAgo(new Date(lastUpdated).toISOString(), now)} · refreshes automatically
        </p>
        <button type="button" className={textActionClass} onClick={() => void refreshFleet()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {showFilters ? (
        <div className="px-4">
          <SegmentedControl<string>
            label="Connectivity"
            value={healthFilter}
            onChange={setHealthFilter}
            options={[
              { value: "all", label: "All" },
              { value: "online", label: "Online" },
              { value: "offline", label: "Offline" },
              { value: "pending_setup", label: "Setting up" },
            ]}
          />
        </div>
      ) : null}

      {message ? <p role="status" className="px-4 text-[15px]">{message}</p> : null}

      {installations.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-[17px] font-semibold">No venue PC connected yet</p>
          <p className="mt-1 text-[15px] text-muted-foreground">Follow the setup steps below to install VenueEdge on the venue PC.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="px-4 py-10 text-center text-[15px] text-muted-foreground">No venue PCs match this filter.</p>
      ) : (
        filtered.map((installation) => {
          const checks = buildHealthChecks(installation, now)
          const metrics = installation.heartbeatMetrics
          return (
            <section key={installation.id} className="space-y-1">
              <SectionHeader
                accessory={
                  <button
                    type="button"
                    className="text-[13px] text-muted-foreground transition-opacity hover:text-destructive active:opacity-50"
                    disabled={loading}
                    onClick={() => void handleRemoveInstallation(installation)}
                  >
                    Remove from fleet
                  </button>
                }
              >
                {installation.displayName}
              </SectionHeader>
              <GroupedList>
                <li>
                  <Link
                    href={installation.nextAction.href}
                    className="flex items-center gap-3 px-4 py-3 transition-colors duration-100 hover:bg-muted/30 active:bg-muted/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold">{statusLine(installation, checks)}</p>
                      <p className="text-[13px] text-muted-foreground">{installation.nextAction.detail}</p>
                    </div>
                    <span className="shrink-0 text-[15px] text-primary">{installation.nextAction.label}</span>
                    <CaretRightIcon size={14} className="shrink-0 text-muted-foreground/50" aria-hidden />
                  </Link>
                </li>
                {checks.map((check) => (
                  <li key={check.label} className="flex items-baseline justify-between gap-4 px-4 py-3 text-[15px]">
                    <span>{check.label}</span>
                    <span
                      className={`min-w-0 text-right ${check.problem ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                      suppressHydrationWarning
                    >
                      {check.value}
                    </span>
                  </li>
                ))}
              </GroupedList>
              <details className="group">
                <summary className="cursor-pointer list-none px-4 pt-1.5 text-[13px] text-primary">
                  <span className="group-open:hidden">Show technical details</span>
                  <span className="hidden group-open:inline">Hide technical details</span>
                </summary>
                <dl className="mt-2 grid gap-x-6 gap-y-1.5 px-4 text-[13px] sm:grid-cols-2">
                  {[
                    ["System", `${installation.platform} · ${installation.architecture}`],
                    ["Agent", `${installation.currentAgentVersion}${installation.desiredAgentVersion ? ` → ${installation.desiredAgentVersion}` : ""} · ${installation.updateChannel}${installation.pinnedVersion ? ` · pinned ${installation.pinnedVersion}` : ""}`],
                    ["Updates", `${installation.updateStatus}${installation.lastUpdateOutcome ? ` · last ${installation.lastUpdateOutcome}` : ""}${installation.lastSuccessfulVersion ? ` · last ok ${installation.lastSuccessfulVersion}` : ""}`],
                    ["Configuration", `desired v${installation.desiredTopology.revisionVersion ?? "—"} · applied v${installation.appliedTopology.revisionVersion ?? "—"}`],
                    ["Recorders", `${installation.reportedTopology.topology.nvrCount} NVR · ffmpeg ${metrics?.ffmpegRunning ? "running" : "idle"}`],
                    ["Resources", metrics ? `CPU ${metrics.cpuPercent === null ? "—" : `${metrics.cpuPercent.toFixed(0)}%`} · ${formatBytes(metrics.freeMemoryBytes)} RAM free · buffer ${metrics.bufferAgeSeconds === null ? "—" : `${Math.round(metrics.bufferAgeSeconds)}s`}` : "No heartbeat metrics yet"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex gap-2">
                      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
                      <dd className="min-w-0">{value}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            </section>
          )
        })
      )}
      {installations.length > 0 ? (
        <SectionFooter>Tap the status row to open the installation and its next step.</SectionFooter>
      ) : null}
    </div>
  )
}
