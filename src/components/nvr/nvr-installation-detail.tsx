"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, CircleIcon, CloudArrowUpIcon, WrenchIcon } from "@phosphor-icons/react"

import { NvrConfigStatus } from "@/components/nvr/nvr-config-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { VenueEdgeInstallationDetailView, VenueEdgeLifecycleStage } from "@/server/replays/venue-edge-fleet"

const STAGES: Array<{ id: VenueEdgeLifecycleStage; label: string; description: string }> = [
  { id: "pair_device", label: "Pair device", description: "Connect this venue PC securely." },
  { id: "add_nvr", label: "Add NVR", description: "Save one unique recorder endpoint." },
  { id: "review_cameras", label: "Review cameras", description: "Verify only real, working channels." },
  { id: "map_tables", label: "Map tables", description: "Assign primary and failover cameras." },
  { id: "publish_config", label: "Publish & apply", description: "Send the reviewed configuration." },
  { id: "complete_commissioning", label: "Commission", description: "Complete the final local checks." },
]

function readApiErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback
  const record = payload as { message?: unknown; error?: { message?: unknown } }
  if (typeof record.message === "string" && record.message.trim()) return record.message
  if (typeof record.error?.message === "string" && record.error.message.trim()) return record.error.message
  return fallback
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not yet"
}

export function NvrInstallationDetail({ installation: initialInstallation, canManage }: { installation: VenueEdgeInstallationDetailView; canManage: boolean }) {
  const [installation, setInstallation] = useState(initialInstallation)
  const initialIndex = Math.max(0, STAGES.findIndex((stage) => stage.id === initialInstallation.lifecycleStage))
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const [displayName, setDisplayName] = useState(initialInstallation.displayName)
  const [reason, setReason] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [replacePairingCode, setReplacePairingCode] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const currentStageIndex = Math.max(0, STAGES.findIndex((stage) => stage.id === installation.lifecycleStage))
  const stage = STAGES[activeIndex] ?? STAGES[0]
  const snapshot = installation.commissioningSnapshot

  const refreshDetail = useCallback(async () => {
    const response = await fetch(`/api/operator/venue-edge/installations/${installation.id}`, { cache: "no-store" })
    if (!response.ok) return
    const payload = (await response.json()) as { data?: { installation?: VenueEdgeInstallationDetailView } }
    if (payload.data?.installation) setInstallation(payload.data.installation)
  }, [installation.id])

  useEffect(() => {
    if (installation.readiness === "ready") return
    const timer = window.setInterval(() => void refreshDetail(), 5000)
    return () => window.clearInterval(timer)
  }, [installation.readiness, refreshDetail])

  useEffect(() => {
    if (activeIndex < currentStageIndex) setActiveIndex(currentStageIndex)
  }, [activeIndex, currentStageIndex])

  async function postAction(action: "reconcile_snapshot" | "publish_config" | "recover_config_stale" | "sync_commissioning" | "revoke" | "rotate_credential" | "rollback_config", extra?: Record<string, string>) {
    const response = await fetch(`/api/operator/venue-edge/installations/${installation.id}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason, ...extra }) })
    if (!response.ok) throw new Error(readApiErrorMessage(await response.json().catch(() => null), "VenueEdge action failed."))
  }

  function runAction(action: Parameters<typeof postAction>[0], extra?: Record<string, string>) {
    setMessage(null)
    startTransition(async () => {
      try { await postAction(action, extra); setMessage("Action completed. Status will update automatically."); setReason(""); await refreshDetail() }
      catch (error) { setMessage(error instanceof Error ? error.message : "VenueEdge action failed.") }
    })
  }

  function publishReviewedConfiguration() {
    setMessage(null)
    startTransition(async () => {
      try {
        if (installation.configDiagnostic?.staleReason === "version_not_newer") await postAction("recover_config_stale")
        else { await postAction("reconcile_snapshot"); await postAction("publish_config") }
        setMessage("Configuration published. Waiting for the venue PC to apply it…")
        setReason(""); await refreshDetail()
      } catch (error) { setMessage(error instanceof Error ? error.message : "Could not publish configuration.") }
    })
  }

  function saveDisplayName() {
    setMessage(null)
    startTransition(async () => {
      const response = await fetch(`/api/operator/venue-edge/installations/${installation.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName, reason }) })
      if (!response.ok) return setMessage(readApiErrorMessage(await response.json().catch(() => null), "Could not rename installation."))
      setMessage("Installation renamed."); setReason(""); await refreshDetail()
    })
  }

  function handleReplacePc() {
    setMessage(null); setReplacePairingCode(null)
    startTransition(async () => {
      const response = await fetch("/api/operator/venue-edge/pairing-sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locationId: installation.locationId, replaceInstallationId: installation.id }) })
      if (!response.ok) return setMessage(readApiErrorMessage(await response.json().catch(() => null), "Could not create replace-PC pairing session."))
      const payload = (await response.json()) as { data?: { session?: { pairingCode?: string } } }
      if (!payload.data?.session?.pairingCode) return setMessage("Replace-PC session created without a displayable code.")
      setReplacePairingCode(payload.data.session.pairingCode); setMessage("Enter this code on the replacement venue PC.")
    })
  }

  function clearResourceOverride(resourceId: string) {
    setMessage(null)
    startTransition(async () => {
      const response = await fetch(`/api/operator/venue-edge/resources/${resourceId}/source-policy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearOverride: true, selectionMode: "automatic", locationId: installation.locationId, reason }),
      })
      if (!response.ok) return setMessage(readApiErrorMessage(await response.json().catch(() => null), "Could not clear the manual camera override."))
      setMessage("Manual camera override cleared and configuration published.")
      setReason("")
      await refreshDetail()
    })
  }

  const activeBlockers = useMemo(() => installation.checklistBlockers.filter((blocker) => blocker.stage === stage.id), [installation.checklistBlockers, stage.id])
  const reasonReady = reason.trim().length >= 4

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm"><Link href={`/nvr?venueId=${installation.locationId}`}><ArrowLeftIcon />Fleet</Link></Button>
        <div className="flex items-center gap-2"><Badge variant={installation.readiness === "ready" ? "default" : "outline"}>{installation.readiness === "ready" ? "Ready" : "Action required"}</Badge><Badge variant="outline">{installation.connectivity}</Badge></div>
      </div>

      <div className="lg:hidden" aria-label="Setup progress"><div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium">Step {activeIndex + 1} of {STAGES.length}</span><span className="text-muted-foreground">{stage.label}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${((activeIndex + 1) / STAGES.length) * 100}%` }} /></div></div>

      <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <nav className="hidden rounded-2xl bg-muted/45 p-3 lg:block" aria-label="VenueEdge setup stages">
          <ol className="space-y-1">{STAGES.map((item, index) => { const complete = index < currentStageIndex || installation.readiness === "ready"; const active = index === activeIndex; return <li key={item.id}><button className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors ${active ? "bg-background shadow-sm" : "hover:bg-background/70"}`} onClick={() => setActiveIndex(index)}><span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${complete ? "bg-emerald-600 text-white" : active ? "bg-primary text-primary-foreground" : "text-muted-foreground ring-1 ring-border"}`}>{complete ? <CheckIcon size={14} weight="bold" /> : <CircleIcon size={12} weight="fill" />}</span><span><span className="block text-sm font-semibold">{item.label}</span><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{item.description}</span></span></button></li> })}</ol>
        </nav>

        <main className="min-w-0 rounded-2xl bg-card p-5 ring-1 ring-border sm:p-7" id={stage.id}>
          <div className="border-b pb-5"><p className="text-sm font-medium text-primary">Step {activeIndex + 1} of {STAGES.length}</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-balance">{stage.label}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{stage.description}</p></div>

          <div className="py-6">
            {activeBlockers.length ? <div className="space-y-3">{activeBlockers.map((blocker) => <div key={blocker.code} className="rounded-xl bg-amber-50 p-4 text-amber-950"><p className="font-semibold">{blocker.label}</p><p className="mt-1 text-sm leading-6">{blocker.detail}</p></div>)}</div> : <div className="rounded-xl bg-emerald-50 p-4 text-emerald-950"><p className="font-semibold">This stage is complete</p><p className="mt-1 text-sm">You can review it here or move to the next stage.</p></div>}

            {stage.id === "pair_device" ? <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Installation</dt><dd className="font-medium">{installation.displayName}</dd></div><div><dt className="text-muted-foreground">Last heartbeat</dt><dd>{formatDate(installation.lastHeartbeatAt)}</dd></div></dl> : null}
            {stage.id === "add_nvr" || stage.id === "review_cameras" || stage.id === "map_tables" ? <div className="mt-5"><h3 className="font-semibold">Local report</h3><p className="mt-1 text-sm text-muted-foreground">{installation.reportedTopology.topology.nvrCount} NVR · {installation.reportedTopology.topology.enabledCameraCount} enabled of {installation.reportedTopology.topology.cameraCount} cameras · {snapshot?.resourceRoutes?.length ?? 0} table routes</p><p className="mt-2 text-xs text-muted-foreground">Reported {formatDate(installation.reportedTopology.observedAt)}. Recorder passwords stay on the venue PC.</p></div> : null}
            {stage.id === "publish_config" ? <div className="mt-5 space-y-5"><NvrConfigStatus installation={installation} />{canManage ? <div className="space-y-2"><Label htmlFor="publish-reason">Reason for publishing</Label><Input id="publish-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reviewed camera and table mappings" /><Button className="mt-2" disabled={isPending || !reasonReady || installation.configDiagnostic?.staleReason === "installation_mismatch"} onClick={publishReviewedConfiguration}><CloudArrowUpIcon />{isPending ? "Publishing…" : installation.configDiagnostic?.staleReason === "version_not_newer" ? "Publish newer revision" : "Publish reviewed configuration"}</Button></div> : null}</div> : null}
            {stage.id === "complete_commissioning" ? <div className="mt-5 space-y-3 text-sm"><p>Return to the local VenueEdge loopback wizard, run preview and failover checks, then choose <strong>Complete commissioning</strong>.</p><p className="text-muted-foreground">This cloud page will update automatically when the local agent reports completion.</p></div> : null}
          </div>

          <div className="flex items-center justify-between border-t pt-5"><Button variant="outline" disabled={activeIndex === 0} onClick={() => setActiveIndex((value) => Math.max(0, value - 1))}><ArrowLeftIcon />Back</Button><Button variant="outline" disabled={activeIndex === STAGES.length - 1 || activeIndex >= currentStageIndex} onClick={() => setActiveIndex((value) => Math.min(STAGES.length - 1, value + 1))}>Continue<ArrowRightIcon /></Button></div>
        </main>
      </div>

      {message ? <p role="status" className="rounded-xl bg-muted px-4 py-3 text-sm">{message}</p> : null}

      <details id="technician" className="rounded-2xl bg-card ring-1 ring-border">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><WrenchIcon />Technician details<span className="ml-auto text-sm font-normal text-muted-foreground">Identity, recovery, and event history</span></summary>
        <div className="space-y-6 border-t p-5">
          <section><h3 className="font-semibold">Topology comparison</h3><div className="mt-3 grid gap-3 sm:grid-cols-3">{[["Local reported", installation.reportedTopology], ["Cloud desired", installation.desiredTopology], ["Agent applied", installation.appliedTopology]].map(([label, value]) => { const state = value as VenueEdgeInstallationDetailView["reportedTopology"]; return <div key={label as string} className="rounded-xl bg-muted/50 p-4"><p className="text-xs font-medium text-muted-foreground">{label as string}</p><p className="mt-2 font-semibold">{state.topology.nvrCount} NVR · {state.topology.enabledCameraCount}/{state.topology.cameraCount} cameras</p><p className="mt-1 text-xs text-muted-foreground">v{state.revisionVersion ?? "—"} · {formatDate(state.observedAt)}</p></div> })}</div><p className="mt-3 text-sm text-muted-foreground">{installation.topologyDrift.summary}</p></section>
          {canManage ? <section className="space-y-3"><h3 className="font-semibold">Administrative actions</h3><div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="display-name">Display name</Label><Input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></div><div><Label htmlFor="admin-reason">Reason (required)</Label><Input id="admin-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this change needed?" /></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={isPending || !reasonReady} onClick={saveDisplayName}>Rename</Button><Button variant="outline" disabled={isPending || !reasonReady} onClick={handleReplacePc}>Replace PC</Button><Button variant="outline" disabled={isPending || !reasonReady} onClick={() => runAction("rotate_credential")}>Rotate credential</Button><Button variant="destructive" disabled={isPending || !reasonReady} onClick={() => runAction("revoke")}>Revoke installation</Button></div>{(snapshot?.resourcePolicies ?? []).filter((policy) => policy.selectionMode === "manual" && typeof policy.manualSourceId === "string").map((policy) => <div key={String(policy.resourceId)} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 p-3 text-sm"><span>Manual camera override on resource {String(policy.resourceId)}</span><Button size="sm" variant="outline" disabled={isPending || !reasonReady} onClick={() => clearResourceOverride(String(policy.resourceId))}>Clear override</Button></div>)}{replacePairingCode ? <p className="rounded-xl bg-primary/10 p-4 font-mono text-lg tracking-widest">{replacePairingCode}</p> : null}</section> : null}
          <section><h3 className="font-semibold">Configuration history</h3>{installation.recentConfigApplications.length ? <ol className="mt-3 divide-y text-sm">{installation.recentConfigApplications.map((event) => <li key={event.id} className="flex flex-wrap justify-between gap-2 py-3"><span>Revision v{event.revisionVersion} · {event.status}{event.errorCode ? ` · ${event.errorCode}` : ""}</span><time className="text-muted-foreground">{formatDate(event.attemptedAt)}</time></li>)}</ol> : <p className="mt-2 text-sm text-muted-foreground">No configuration events yet.</p>}</section>
        </div>
      </details>
    </div>
  )
}
