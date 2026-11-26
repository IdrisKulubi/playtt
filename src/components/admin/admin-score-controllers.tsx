"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { ArrowsClockwiseIcon, GameControllerIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ScoreControllersView } from "@/server/devices/score-controllers"

const NONE = "none"
const REFRESH_MS = 30_000

/** tableId -> controllerId (or null) as the person has arranged it. */
type Draft = Record<string, string | null>

const draftFrom = (view: ScoreControllersView): Draft =>
  Object.fromEntries(view.tables.map((table) => [table.id, table.controllerId]))

function errorMessage(payload: unknown, fallback: string) {
  const record = payload as { message?: unknown } | null
  return typeof record?.message === "string" && record.message ? record.message : fallback
}

function seenAgo(iso: string | null) {
  if (!iso) return "never seen"
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (minutes < 2) return "seen just now"
  if (minutes < 90) return `seen ${minutes} min ago`
  const hours = Math.round(minutes / 60)
  return hours < 36 ? `seen ${hours} h ago` : `seen ${new Date(iso).toLocaleDateString()}`
}

/**
 * Score controllers work like cameras: set up once, then placed on any table
 * and moved between tables or venues without setting them up again.
 */
export function AdminScoreControllers({ venueId, canManage }: { venueId: string; canManage: boolean }) {
  const [view, setView] = useState<ScoreControllersView | null>(null)
  const [draft, setDraft] = useState<Draft>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sendTo, setSendTo] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  const endpoint = `/api/admin/venues/${venueId}/score-controllers`

  const load = useCallback(
    async (resetDraft: boolean) => {
      const response = await fetch(endpoint, { cache: "no-store" })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(errorMessage(payload, "Couldn't load score controllers."))
      const next = (payload as { data?: { view?: ScoreControllersView } }).data?.view
      if (!next) return
      setView(next)
      setLoadError(null)
      if (resetDraft) {
        setDraft(draftFrom(next))
        setNotes({})
      }
    },
    [endpoint],
  )

  useEffect(() => {
    load(true).catch((error) => setLoadError(error instanceof Error ? error.message : "Couldn't load score controllers."))
    // Online/offline changes on its own; keep it current without losing edits.
    const timer = window.setInterval(() => void load(false).catch(() => {}), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const controllersById = useMemo(() => new Map((view?.controllers ?? []).map((item) => [item.id, item])), [view])
  const tableOfController = useMemo(() => {
    const map = new Map<string, string>()
    for (const [tableId, controllerId] of Object.entries(draft)) if (controllerId) map.set(controllerId, tableId)
    return map
  }, [draft])
  const tableLabel = useMemo(() => new Map((view?.tables ?? []).map((table) => [table.id, table.label])), [view])

  const dirtyTables = useMemo(
    () => (view?.tables ?? []).filter((table) => (draft[table.id] ?? null) !== table.controllerId),
    [draft, view],
  )

  function choose(tableId: string, controllerId: string | null) {
    setMessage(null)
    setDraft((previous) => {
      const next = { ...previous }
      const before = next[tableId] ?? null
      // A controller already on another table swaps with this table's one,
      // so a mix-up is fixed in one step.
      const otherTableId = controllerId
        ? Object.keys(next).find((id) => id !== tableId && next[id] === controllerId)
        : undefined
      next[tableId] = controllerId
      const newNotes: Record<string, string> = {}
      if (otherTableId) {
        next[otherTableId] = before
        newNotes[tableId] = `Swapped with ${tableLabel.get(otherTableId) ?? "the other table"}.`
        newNotes[otherTableId] = before ? `Now uses ${controllersById.get(before)?.label ?? "the other controller"}.` : "Now has no controller."
      }
      setNotes((current) => ({ ...current, ...newNotes }))
      return next
    })
  }

  function save() {
    if (!view || dirtyTables.length === 0) return
    setMessage(null)
    startTransition(async () => {
      try {
        const response = await fetch(endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tables: dirtyTables.map((table) => ({ tableId: table.id, controllerId: draft[table.id] ?? null })),
          }),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(errorMessage(payload, "Couldn't save the controllers."))
        const data = (payload as { data?: { view?: ScoreControllersView } }).data
        if (data?.view) {
          setView(data.view)
          setDraft(draftFrom(data.view))
          setNotes({})
        }
        setMessage("Saved. Controllers score on their new tables from the next button press.")
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Couldn't save the controllers.")
      }
    })
  }

  function moveToVenue(controllerId: string, toVenueId: string, label: string) {
    setMessage(null)
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/score-controllers/${controllerId}/venue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ venueId: toVenueId }),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(errorMessage(payload, "Couldn't move the controller."))
        await load(true)
        setMessage(
          toVenueId === venueId
            ? `${label} is here now as a spare. Put it on a table below.`
            : `${label} moved to ${view?.venues.find((venue) => venue.id === toVenueId)?.name ?? "the other venue"}.`,
        )
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Couldn't move the controller.")
      }
    })
  }

  const shell = (body: React.ReactNode) => (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <h2 className="text-lg font-semibold tracking-tight">Score controllers</h2>
      {body}
    </section>
  )

  if (loadError && !view) return shell(<p className="mt-2 text-sm text-muted-foreground">{loadError}</p>)
  if (!view) return shell(<p className="mt-2 text-sm text-muted-foreground">Loading…</p>)

  return (
    <div className="space-y-6">
      <section aria-labelledby="score-controllers-heading" className="rounded-2xl bg-card p-5 ring-1 ring-border sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="score-controllers-heading" className="text-lg font-semibold tracking-tight">
            Score controllers
          </h2>
          <p className="text-sm text-muted-foreground">
            {view.controllers.length} {view.controllers.length === 1 ? "controller" : "controllers"} · {view.tables.length}{" "}
            {view.tables.length === 1 ? "table" : "tables"}
          </p>
        </div>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          Choose the controller for each table. Picking one that&apos;s already on another table swaps the two. Changes
          apply straight away; there&apos;s no need to set a controller up again.
        </p>

        {view.controllers.length === 0 ? (
          <p className="mt-5 text-sm text-muted-foreground">
            No controllers at this venue. Move one here from another venue below, or set up a new one in Devices.
          </p>
        ) : (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {view.controllers.map((controller) => {
              const onTable = tableOfController.get(controller.id)
              const target = sendTo[controller.id] ?? NONE
              return (
                <li key={controller.id} className="min-w-0 rounded-xl bg-muted/50 p-4">
                  <div className="flex items-start gap-3">
                    <GameControllerIcon size={22} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{controller.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {onTable ? `On ${tableLabel.get(onTable)}` : "Spare"} ·{" "}
                        <span className={controller.online ? "text-foreground" : undefined}>
                          {controller.online ? "Online" : `Offline, ${seenAgo(controller.lastSeenAt)}`}
                        </span>
                      </p>
                    </div>
                  </div>
                  {canManage && view.venues.length > 0 ? (
                    <div className="mt-3 flex items-center gap-2">
                      <Select
                        disabled={isPending}
                        value={target}
                        onValueChange={(value) => setSendTo((current) => ({ ...current, [controller.id]: value }))}
                      >
                        <SelectTrigger className="h-8 min-w-0 flex-1 text-xs" aria-label={`Send ${controller.label} to another venue`}>
                          <SelectValue placeholder="Send to venue…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Send to venue…</SelectItem>
                          {view.venues.map((venue) => (
                            <SelectItem key={venue.id} value={venue.id}>
                              {venue.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending || target === NONE}
                        onClick={() => moveToVenue(controller.id, target, controller.label)}
                      >
                        Move
                      </Button>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}

        {view.tables.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">This venue has no tables yet. Add tables, then place controllers here.</p>
        ) : (
          <div className="mt-6 divide-y border-t">
            {view.tables.map((table) => {
              const selected = draft[table.id] ?? null
              const changed = selected !== table.controllerId
              const status = notes[table.id]
                ?? (!table.active
                  ? "Table is inactive in PlayTT"
                  : changed && table.inSession
                    ? "In a session now: scoring moves with the controller when you save."
                    : selected
                      ? table.inSession
                        ? "Keeping score in a session now"
                        : "Ready to keep score"
                      : "No controller: players can't book this table")
              return (
                <div key={table.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-end">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{table.label}</p>
                    <p className="text-xs text-muted-foreground">{status}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`controller-${table.id}`} className="text-xs text-muted-foreground">
                      Controller
                    </Label>
                    <Select
                      disabled={!canManage || isPending}
                      value={selected ?? NONE}
                      onValueChange={(value) => choose(table.id, value === NONE ? null : value)}
                    >
                      <SelectTrigger id={`controller-${table.id}`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>No controller</SelectItem>
                        {view.controllers.map((controller) => (
                          <SelectItem key={controller.id} value={controller.id}>
                            {controller.label}
                            {controller.online ? "" : " (offline)"}
                          </SelectItem>
                        ))}
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
            <Button disabled={isPending || dirtyTables.length === 0} onClick={save}>
              {isPending ? "Saving…" : "Save changes"}
            </Button>
            <Button
              variant="ghost"
              disabled={isPending || dirtyTables.length === 0}
              onClick={() => {
                setDraft(draftFrom(view))
                setNotes({})
                setMessage(null)
              }}
            >
              Discard
            </Button>
            <Button variant="ghost" className="ml-auto" disabled={isPending} onClick={() => void load(false).catch(() => {})}>
              <ArrowsClockwiseIcon />
              Refresh
            </Button>
          </div>
        ) : null}
        {message ? (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}
      </section>

      {view.elsewhere.length > 0 ? (
        <section aria-labelledby="other-controllers-heading" className="rounded-2xl bg-card p-5 ring-1 ring-border sm:p-6">
          <h2 id="other-controllers-heading" className="text-lg font-semibold tracking-tight">
            At other venues
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Bring a controller here. It arrives as a spare; its old table stops being bookable until it gets another one.
          </p>
          <ul className="mt-4 divide-y border-t">
            {view.elsewhere.map((controller) => (
              <li key={controller.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{controller.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {controller.venueName}
                    {controller.tableName ? ` · ${controller.tableName}` : " · spare"} · {controller.online ? "Online" : "Offline"}
                  </p>
                </div>
                {canManage ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => moveToVenue(controller.id, venueId, controller.label)}
                  >
                    Move here
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
