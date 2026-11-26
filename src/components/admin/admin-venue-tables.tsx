"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { PlusIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface VenueTableRow {
  id: string
  name: string
  zoneName: string | null
  isActive: boolean
  /** Camera the table records from, when a venue PC is set up. */
  cameraLabel: string | null
  /** Bookable only with score buttons and a camera assigned. */
  readiness: { hasScoreInput: boolean; hasCamera: boolean }
  backupCameraLabel: string | null
}

/** An upcoming booking on a table that isn't ready, with no ready table free to move it to. */
export interface StrandedBookingRow {
  bookingId: string
  tableName: string
  firstName: string
  /** Already formatted in the venue's time zone, e.g. "Thu 26 Nov, 12:25 – 13:25". */
  when: string
  paid: boolean
}

const NO_ZONE = "none"

export function AdminVenueTables({
  venueId,
  tables,
  zones,
  canManage,
  hasVenuePc,
  strandedBookings = [],
}: {
  venueId: string
  tables: VenueTableRow[]
  strandedBookings?: StrandedBookingRow[]
  zones: { id: string; name: string }[]
  canManage: boolean
  hasVenuePc: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const wantsAdd = searchParams.get("add") === "1"
  const [adding, setAdding] = useState(wantsAdd)
  const [name, setName] = useState("")
  const [zoneId, setZoneId] = useState(zones.length === 1 ? zones[0].id : NO_ZONE)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isSaving, setIsSaving] = useState(false)
  const nameInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (wantsAdd) setAdding(true)
  }, [wantsAdd])

  useEffect(() => {
    if (adding) nameInput.current?.focus()
  }, [adding])

  function closeForm() {
    setAdding(false)
    setName("")
    setError(null)
    if (wantsAdd) router.replace(`${pathname}?tab=tables`, { scroll: false })
  }

  async function addTable(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setError(null)
    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/venues/${venueId}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, code: null, zoneId: zoneId === NO_ZONE ? null : zoneId }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setError(payload?.message ?? payload?.error?.message ?? "Couldn't add the table. Try again.")
        return
      }
      closeForm()
      startTransition(() => router.refresh())
    } finally {
      setIsSaving(false)
    }
  }

  const nextName = `Table ${tables.length + 1}`

  return (
    <Card>
      <CardContent className="space-y-5">
        {strandedBookings.length > 0 ? <StrandedBookings bookings={strandedBookings} /> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Tables</h2>
            <p className="text-sm text-muted-foreground">
              {tables.length === 0
                ? "Add the tables players can book at this venue."
                : `${tables.length} ${tables.length === 1 ? "table" : "tables"} at this venue.`}
            </p>
          </div>
          {canManage && !adding ? (
            <Button size="sm" onClick={() => setAdding(true)}>
              <PlusIcon /> Add table
            </Button>
          ) : null}
        </div>

        {adding ? (
          <form onSubmit={addTable} className="space-y-3 rounded-2xl border p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-table-name">Table name</Label>
                <Input
                  id="new-table-name"
                  ref={nameInput}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={nextName}
                  required
                />
              </div>
              {zones.length > 0 ? (
                <div className="space-y-1.5">
                  <Label>Area</Label>
                  <Select value={zoneId} onValueChange={setZoneId}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_ZONE}>No area</SelectItem>
                      {zones.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
            {hasVenuePc ? (
              <p className="text-xs text-muted-foreground">
                After adding it, choose its camera in the Cameras tab.
              </p>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isSaving || isPending || !name.trim()}>
                {isSaving ? "Adding…" : "Add table"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={closeForm}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {tables.length > 0 ? (
          <ul className="divide-y rounded-2xl border">
            {tables.map((table) => (
              <TableRow
                key={table.id}
                venueId={venueId}
                table={table}
                canManage={canManage}
                hasVenuePc={hasVenuePc}
                camerasHref={`${pathname}?tab=cameras`}
              />
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}

function TableRow({
  venueId,
  table,
  canManage,
  hasVenuePc,
  camerasHref,
}: {
  venueId: string
  table: VenueTableRow
  canManage: boolean
  hasVenuePc: boolean
  camerasHref: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(table.name)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isPending, startTransition] = useTransition()

  function cancel() {
    setEditing(false)
    setName(table.name)
    setError(null)
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (trimmed === table.name) {
      cancel()
      return
    }
    setError(null)
    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/venues/${venueId}/resources/${table.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setError(payload?.message ?? payload?.error?.message ?? "Couldn't rename the table. Try again.")
        return
      }
      setEditing(false)
      startTransition(() => router.refresh())
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
      <div className="min-w-40 flex-1">
        {editing ? (
          <form onSubmit={save} className="flex flex-wrap items-center gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") cancel()
              }}
              aria-label="Table name"
              maxLength={80}
              autoFocus
              className="h-8 max-w-60"
            />
            <Button type="submit" size="sm" disabled={isSaving || isPending || !name.trim()}>
              {isSaving ? "Saving…" : "Save"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={cancel}>
              Cancel
            </Button>
            {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
          </form>
        ) : (
          <>
            <p className="font-medium">
              {table.name}
              {!table.isActive ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground">Inactive</span>
              ) : null}
              {canManage ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="ml-3 text-sm font-normal text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Rename
                </button>
              ) : null}
            </p>
            {table.zoneName ? <p className="text-sm text-muted-foreground">{table.zoneName}</p> : null}
            <TableBookable table={table} />
          </>
        )}
      </div>

      {hasVenuePc ? (
        <div className="min-w-40 text-sm">
          <p className="text-muted-foreground">Camera</p>
          <Link href={camerasHref} className="underline-offset-4 hover:underline">
            {table.cameraLabel ?? "Choose a camera"}
            {table.cameraLabel && table.backupCameraLabel ? (
              <span className="text-muted-foreground"> · backup {table.backupCameraLabel}</span>
            ) : null}
          </Link>
        </div>
      ) : null}

      <div className="flex gap-4 text-sm">
        <TableLink href={`/replay?resourceId=${table.id}`}>Tablet</TableLink>
        <TableLink href={`/pod/tv?resourceId=${table.id}`}>TV</TableLink>
      </div>
    </li>
  )
}

/**
 * Bookings PlayTT couldn't move by itself: their table isn't ready and every
 * ready table is taken at that time. Staff fix the table, or contact the player.
 */
function StrandedBookings({ bookings }: { bookings: StrandedBookingRow[] }) {
  return (
    <section className="space-y-3 rounded-lg border p-4" aria-labelledby="stranded-bookings">
      <div>
        <h3 id="stranded-bookings" className="font-semibold">
          {bookings.length === 1 ? "1 booking needs you" : `${bookings.length} bookings need you`}
        </h3>
        <p className="text-sm text-muted-foreground">
          These are on a table without score buttons or a camera, and no ready table is free at that
          time. Assign what&apos;s missing to the table, or contact the player to move or refund.
        </p>
      </div>
      <ul className="divide-y text-sm">
        {bookings.map((booking) => (
          <li key={booking.bookingId} className="flex flex-wrap justify-between gap-2 py-2">
            <span>
              <span className="font-medium">{booking.firstName}</span> · {booking.tableName}
              {booking.paid ? null : <span className="text-muted-foreground"> · not paid yet</span>}
            </span>
            <span className="text-muted-foreground tabular-nums">{booking.when}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Says whether players can book the table, and what's missing if not. */
function TableBookable({ table }: { table: VenueTableRow }) {
  if (!table.isActive) return null
  const missing = [
    table.readiness.hasScoreInput ? null : "score buttons",
    table.readiness.hasCamera ? null : "a camera",
  ].filter(Boolean)

  if (missing.length === 0) {
    return <p className="text-sm text-muted-foreground">Open for booking</p>
  }

  return (
    <p className="text-sm text-muted-foreground">
      Not bookable: assign {missing.join(" and ")}
    </p>
  )
}

function TableLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
      {children}
    </a>
  )
}
