"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { ArrowsClockwiseIcon, VideoCameraIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type {
  CameraAssignmentCamera,
  CameraAssignmentTable,
  CameraAssignmentsView,
} from "@/server/replays/venue-edge-camera-assignments"

const NONE = "none"
const REFRESH_MS = 30_000

type Draft = Record<string, { primary: string | null; backup: string | null }>

function draftFrom(tables: CameraAssignmentTable[]): Draft {
  return Object.fromEntries(tables.map((table) => [table.id, { primary: table.primaryCameraId, backup: table.backupCameraId }]))
}

function errorMessage(payload: unknown, fallback: string) {
  const record = payload as { message?: unknown; error?: { message?: unknown } } | null
  const value = record?.error?.message ?? record?.message
  return typeof value === "string" && value ? value : fallback
}

function capturedAgo(iso: string | null) {
  if (!iso) return null
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000))
  if (seconds < 90) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 90) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  return hours < 36 ? `${hours} h ago` : new Date(iso).toLocaleDateString()
}

function cameraName(camera: CameraAssignmentCamera | undefined) {
  if (!camera) return "No camera"
  return new RegExp(`(^|\\D)${camera.channelKey}(\\D|$)`).test(camera.label) ? camera.label : `${camera.label} · channel ${camera.channelKey}`
}

export function NvrCameraAssignments({ installationId, canManage }: { installationId: string; canManage: boolean }) {
  const [view, setView] = useState<CameraAssignmentsView | null>(null)
  const [draft, setDraft] = useState<Draft>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async (resetDraft: boolean) => {
    const response = await fetch(`/api/operator/venue-edge/installations/${installationId}/cameras`, { cache: "no-store" })
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new Error(errorMessage(payload, "Couldn't load cameras and tables."))
    const next = (payload as { data?: { view?: CameraAssignmentsView } }).data?.view
    if (!next) return
    setView(next)
    setLoadError(null)
    if (resetDraft) {
      setDraft(draftFrom(next.tables))
      setNotes({})
    }
  }, [installationId])

  useEffect(() => {
    load(true).catch((error) => setLoadError(error instanceof Error ? error.message : "Couldn't load cameras and tables."))
    // Stills are refreshed by the venue PC every few minutes; keep them current.
    const timer = window.setInterval(() => void load(false).catch(() => {}), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const camerasById = useMemo(() => new Map((view?.cameras ?? []).map((camera) => [camera.id, camera])), [view])
  const tablesByCamera = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const table of view?.tables ?? []) {
      const primary = draft[table.id]?.primary
      if (primary) map.set(primary, [...(map.get(primary) ?? []), table.label])
    }
    return map
  }, [draft, view])

  const dirtyTables = useMemo(
    () => (view?.tables ?? []).filter((table) => {
      const current = draft[table.id]
      return current && (current.primary !== table.primaryCameraId || current.backup !== table.backupCameraId)
    }),
    [draft, view],
  )

  function choosePrimary(tableId: string, cameraId: string | null) {
    setMessage(null)
    setDraft((previous) => {
      const next = { ...previous }
      const before = next[tableId]?.primary ?? null
      // Choosing a camera that films another table swaps the two, so a
      // camera on the wrong table can be fixed in one step.
      const other = cameraId ? Object.entries(next).find(([id, entry]) => id !== tableId && entry.primary === cameraId) : undefined
      next[tableId] = { primary: cameraId, backup: next[tableId]?.backup === cameraId ? null : next[tableId]?.backup ?? null }
      const newNotes: Record<string, string> = {}
      if (other) {
        const [otherId, otherEntry] = other
        next[otherId] = { primary: before, backup: otherEntry.backup === before ? null : otherEntry.backup }
        const otherLabel = view?.tables.find((table) => table.id === otherId)?.label ?? "the other table"
        newNotes[tableId] = `Swapped with ${otherLabel}.`
        newNotes[otherId] = before ? `Now uses ${cameraName(camerasById.get(before))}.` : "Now has no camera."
      }
      setNotes((current) => ({ ...current, ...newNotes }))
      return next
    })
  }

  function chooseBackup(tableId: string, cameraId: string | null) {
    setMessage(null)
    setDraft((previous) => ({ ...previous, [tableId]: { primary: previous[tableId]?.primary ?? null, backup: cameraId } }))
  }

  function save() {
    if (!view || dirtyTables.length === 0) return
    setMessage(null)
    startTransition(async () => {
      try {
        const response = await fetch(`/api/operator/venue-edge/installations/${installationId}/cameras`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Camera assignment changed in admin",
            assignments: dirtyTables.map((table) => ({
              tableId: table.id,
              primaryCameraId: draft[table.id]?.primary ?? null,
              backupCameraId: draft[table.id]?.backup ?? null,
            })),
          }),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(errorMessage(payload, "Couldn't save the camera assignments."))
        const data = (payload as { data?: { view?: CameraAssignmentsView; revision?: { version?: number } } }).data
        if (data?.view) {
          setView(data.view)
          setDraft(draftFrom(data.view.tables))
          setNotes({})
        }
        setMessage(`Saved as configuration v${data?.revision?.version ?? "?"}. The venue PC switches cameras within a minute.`)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Couldn't save the camera assignments.")
      }
    })
  }

  if (loadError && !view) {
    return <section className="rounded-2xl bg-card p-5 ring-1 ring-border"><h2 className="text-lg font-semibold tracking-tight">Cameras &amp; tables</h2><p className="mt-2 text-sm text-muted-foreground">{loadError}</p></section>
  }
  if (!view) {
    return <section className="rounded-2xl bg-card p-5 ring-1 ring-border"><h2 className="text-lg font-semibold tracking-tight">Cameras &amp; tables</h2><p className="mt-2 text-sm text-muted-foreground">Loading…</p></section>
  }

  const cameraOptions = view.cameras

  return (
    <section aria-labelledby="camera-assignments-heading" className="rounded-2xl bg-card p-5 ring-1 ring-border sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="camera-assignments-heading" className="text-lg font-semibold tracking-tight">Cameras &amp; tables</h2>
        <p className="text-sm text-muted-foreground">
          {view.cameras.length} {view.cameras.length === 1 ? "camera" : "cameras"} · {view.tables.length} {view.tables.length === 1 ? "table" : "tables"}
        </p>
      </div>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
        Check each picture, then choose the camera that films each table. Picking a camera that&apos;s already on another table swaps the two.
      </p>

      {view.cameras.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">No cameras yet. Finish Review cameras on the venue PC and publish the setup.</p>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {view.cameras.map((camera) => {
            const onTables = tablesByCamera.get(camera.id) ?? []
            return (
              <li key={camera.id} className="min-w-0">
                <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
                  {camera.still ? (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                    <img src={camera.still.url} alt={`Latest picture from ${camera.label}`} className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
                      <VideoCameraIcon size={22} />
                      <span className="text-xs">No picture yet</span>
                    </div>
                  )}
                </div>
                <p className="mt-2 truncate text-sm font-medium">{cameraName(camera)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {onTables.length ? `Films ${onTables.join(", ")}` : "Not on a table"}
                  {camera.still?.capturedAt ? ` · ${capturedAgo(camera.still.capturedAt)}` : ""}
                </p>
              </li>
            )
          })}
        </ul>
      )}

      {view.tables.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">This venue has no tables in PlayTT yet. Add tables to the venue, then assign cameras here.</p>
      ) : (
        <div className="mt-6 divide-y border-t">
          {view.tables.map((table) => {
            const entry = draft[table.id] ?? { primary: null, backup: null }
            return (
              <div key={table.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,12rem)_1fr_1fr] sm:items-end">
                <div className="min-w-0">
                  <p className="truncate font-medium">{table.label}</p>
                  <p className="text-xs text-muted-foreground">{notes[table.id] ?? (table.active ? (entry.primary ? "Recording replays" : "No camera yet") : "Table is inactive in PlayTT")}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`camera-${table.id}`} className="text-xs text-muted-foreground">Camera</Label>
                  <Select disabled={!canManage || isPending} value={entry.primary ?? NONE} onValueChange={(value) => choosePrimary(table.id, value === NONE ? null : value)}>
                    <SelectTrigger id={`camera-${table.id}`} className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No camera</SelectItem>
                      {cameraOptions.map((camera) => <SelectItem key={camera.id} value={camera.id}>{cameraName(camera)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`backup-${table.id}`} className="text-xs text-muted-foreground">Backup (optional)</Label>
                  <Select disabled={!canManage || isPending || !entry.primary} value={entry.backup ?? NONE} onValueChange={(value) => chooseBackup(table.id, value === NONE ? null : value)}>
                    <SelectTrigger id={`backup-${table.id}`} className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No backup</SelectItem>
                      {cameraOptions.filter((camera) => camera.id !== entry.primary).map((camera) => <SelectItem key={camera.id} value={camera.id}>{cameraName(camera)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {canManage && view.tables.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
          <Button disabled={isPending || dirtyTables.length === 0} onClick={save}>{isPending ? "Saving…" : "Save changes"}</Button>
          <Button variant="ghost" disabled={isPending || dirtyTables.length === 0} onClick={() => { setDraft(draftFrom(view.tables)); setNotes({}); setMessage(null) }}>Discard</Button>
          <Button variant="ghost" className="ml-auto" disabled={isPending} onClick={() => void load(false).catch(() => {})}><ArrowsClockwiseIcon />Refresh pictures</Button>
          {message ? <p role="status" className="w-full text-sm text-muted-foreground">{message}</p> : null}
        </div>
      ) : null}
    </section>
  )
}
