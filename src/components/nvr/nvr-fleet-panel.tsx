"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { ArrowRightIcon, CheckCircleIcon, DotsThreeIcon, WarningCircleIcon } from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { VenueEdgeInstallationFleetView } from "@/server/replays/venue-edge-fleet"

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

function formatHeartbeatSummary(installation: VenueEdgeInstallationFleetView) {
  const metrics = installation.heartbeatMetrics
  if (!metrics) return "No heartbeat metrics yet"

  const cpu = metrics.cpuPercent === null ? "CPU —" : `CPU ${metrics.cpuPercent.toFixed(0)}%`
  const memory = `mem ${formatBytes(metrics.freeMemoryBytes)} free`
  const disk = `disk ${formatBytes(metrics.diskUsageBytes)}`
  const buffer =
    metrics.bufferAgeSeconds === null
      ? "buffer —"
      : `buffer ${Math.round(metrics.bufferAgeSeconds)}s`
  const upload = `upload ${metrics.uploadHealth}`
  const ffmpeg = metrics.ffmpegRunning ? "ffmpeg running" : "ffmpeg stopped"

  return `${cpu} · ${memory} · ${disk} · ${buffer} · ${upload} · ${ffmpeg}`
}

export function NvrFleetPanel({ selectedVenueId, initialInstallations }: { selectedVenueId: string; initialInstallations: VenueEdgeInstallationFleetView[] }) {
  const router = useRouter()
  const [installations, setInstallations] = useState(initialInstallations)
  const [healthFilter, setHealthFilter] = useState("all")
  const [commissioningFilter, setCommissioningFilter] = useState("all")
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const filtered = useMemo(() => installations.filter((item) => (healthFilter === "all" || item.connectivity === healthFilter) && (commissioningFilter === "all" || item.commissioningState === commissioningFilter)), [installations, healthFilter, commissioningFilter])

  async function refreshFleet() {
    setLoading(true); setMessage(null)
    try {
      const params = new URLSearchParams({ locationId: selectedVenueId })
      if (healthFilter !== "all") params.set("health", healthFilter)
      if (commissioningFilter !== "all") params.set("commissioning", commissioningFilter)
      const response = await fetch(`/api/operator/venue-edge/installations?${params}`)
      if (!response.ok) return setMessage("Could not refresh VenueEdge fleet.")
      const payload = (await response.json()) as { data?: { installations?: VenueEdgeInstallationFleetView[] } }
      setInstallations(payload.data?.installations ?? [])
    } catch { setMessage("Could not refresh VenueEdge fleet.") } finally { setLoading(false) }
  }

  async function handleRemoveInstallation(installation: VenueEdgeInstallationFleetView) {
    if (!window.confirm(`Remove ${installation.displayName} from the active fleet? Historical replay and audit records will be preserved.`)) return
    setLoading(true); setMessage(null)
    try {
      const response = await fetch(`/api/operator/venue-edge/installations/${installation.id}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "revoke", reason: "Removed from active VenueEdge fleet" }) })
      if (!response.ok) { const error = (await response.json()) as { message?: string }; return setMessage(error.message ?? "Could not remove installation.") }
      await refreshFleet()
      router.refresh()
      setMessage(`${installation.displayName} was removed. Historical records were preserved.`)
    } catch { setMessage("Could not remove installation.") } finally { setLoading(false) }
  }

  return (
    <Card className="overflow-visible rounded-2xl shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b pb-5">
        <div className="space-y-1"><CardTitle className="text-lg">VenueEdge fleet</CardTitle><p className="max-w-2xl text-sm text-muted-foreground">One clear next step for every installation at this venue.</p></div>
        <Button variant="outline" onClick={() => void refreshFleet()} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</Button>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div className="flex flex-wrap gap-3" aria-label="Fleet filters">
          <Select value={healthFilter} onValueChange={setHealthFilter}><SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All connectivity</SelectItem><SelectItem value="online">Online</SelectItem><SelectItem value="offline">Offline</SelectItem><SelectItem value="pending_setup">Pending setup</SelectItem></SelectContent></Select>
          <Select value={commissioningFilter} onValueChange={setCommissioningFilter}><SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All commissioning</SelectItem><SelectItem value="commissioned">Commissioned</SelectItem><SelectItem value="not_commissioned">Not commissioned</SelectItem></SelectContent></Select>
        </div>
        {message ? <p role="status" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{message}</p> : null}
        {filtered.length === 0 ? <div className="py-12 text-center"><p className="font-medium">No installations match these filters</p><p className="mt-1 text-sm text-muted-foreground">Change a filter or pair a venue PC below.</p></div> : (
          <ul className="divide-y" aria-label="VenueEdge installations">
            {filtered.map((installation) => {
              const ready = installation.readiness === "ready"
              return <li key={installation.id} className="grid gap-5 py-5 first:pt-0 last:pb-0 lg:grid-cols-[minmax(12rem,1.1fr)_minmax(14rem,1.4fr)_minmax(12rem,1fr)_auto] lg:items-center">
                <div className="flex min-w-0 items-center gap-2"><span className={`grid size-8 shrink-0 place-items-center rounded-full ${ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{ready ? <CheckCircleIcon size={19} weight="fill" /> : <WarningCircleIcon size={19} weight="fill" />}</span><div className="min-w-0"><p className="truncate font-semibold">{installation.displayName}</p><p className="text-xs text-muted-foreground">{installation.platform} · {installation.architecture} · agent {installation.currentAgentVersion}{installation.desiredAgentVersion ? ` → ${installation.desiredAgentVersion}` : ""}</p><p className="text-xs text-muted-foreground">update {installation.updateStatus}{installation.lastUpdateOutcome ? ` · last ${installation.lastUpdateOutcome}` : ""} · {installation.updateChannel}{installation.pinnedVersion ? ` · pinned ${installation.pinnedVersion}` : ""}{installation.lastSuccessfulVersion ? ` · last ok ${installation.lastSuccessfulVersion}` : ""}</p></div></div>
                <div><div className="flex flex-wrap items-center gap-2"><Badge variant={ready ? "default" : "outline"}>{ready ? "Ready" : "Action required"}</Badge><span className="text-xs text-muted-foreground">{installation.connectivity}</span>{installation.diskPressure ? <Badge variant="outline">Disk pressure</Badge> : null}</div><p className="mt-2 text-sm font-medium">{installation.nextAction.detail}</p><p className="mt-1 text-xs text-muted-foreground">{formatHeartbeatSummary(installation)}</p>{installation.sourceHealthRows.length > 0 ? <p className="mt-1 text-xs text-muted-foreground">{installation.sourceHealthRows.filter((row) => row.status !== "healthy" && row.status !== "online").length} source issue{installation.sourceHealthRows.filter((row) => row.status !== "healthy" && row.status !== "online").length === 1 ? "" : "s"} reported</p> : null}</div>
                <dl className="grid grid-cols-2 gap-3 text-sm lg:block"><div><dt className="text-xs text-muted-foreground">Reported</dt><dd>{installation.reportedTopology.topology.nvrCount} NVR · {installation.reportedTopology.topology.enabledCameraCount}/{installation.reportedTopology.topology.cameraCount} cameras</dd></div><div className="lg:mt-2"><dt className="text-xs text-muted-foreground">Configuration</dt><dd>desired v{installation.desiredTopology.revisionVersion ?? "—"} · applied v{installation.appliedTopology.revisionVersion ?? "—"}</dd></div></dl>
                <div className="flex items-center gap-2 lg:justify-end"><Button asChild className="min-w-36"><Link href={installation.nextAction.href}>{installation.nextAction.label}<ArrowRightIcon /></Link></Button><details className="relative"><summary className="grid size-10 cursor-pointer list-none place-items-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`More actions for ${installation.displayName}`}><DotsThreeIcon size={22} weight="bold" /></summary><div className="absolute right-0 z-20 mt-2 min-w-44 rounded-xl bg-popover p-1 shadow-md ring-1 ring-border"><button className="w-full rounded-lg px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50" disabled={loading} onClick={() => void handleRemoveInstallation(installation)}>Remove from fleet</button></div></details></div>
              </li>
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
