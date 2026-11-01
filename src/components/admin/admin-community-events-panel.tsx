"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type AdminEvent = {
  id: string
  title: string
  startsAt: string | null
  maxMembers: number | null
  memberCount: number
  closed: boolean
}

type Venue = { id: string; name: string }

async function post(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(payload?.message ?? "Request failed.")
  }
}

export function AdminCommunityEventsPanel({ events, venues }: { events: AdminEvent[]; venues: Venue[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [maxMembers, setMaxMembers] = useState("16")
  const [locationId, setLocationId] = useState(venues[0]?.id ?? "")

  function create(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await post("/api/admin/community/events", {
          title,
          description: description || undefined,
          // datetime-local has no zone; the browser's offset is applied here.
          startsAt: new Date(startsAt).toISOString(),
          maxMembers: Number(maxMembers),
          locationId: locationId || undefined,
        })
        setTitle("")
        setDescription("")
        setStartsAt("")
        router.refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not create the event.")
      }
    })
  }

  function close(id: string) {
    if (!window.confirm("Close this event? Players can no longer join or chat in it.")) return
    startTransition(async () => {
      await post(`/api/admin/community/events/${id}/close`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="admin-dashboard-card grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="event-title">Title</Label>
          <Input
            id="event-title"
            required
            minLength={3}
            maxLength={80}
            placeholder="King of the Table"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="event-description">Description</Label>
          <Input
            id="event-description"
            maxLength={500}
            placeholder="Winner stays on. All levels welcome."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="event-starts">Starts at</Label>
          <Input
            id="event-starts"
            type="datetime-local"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="event-max">Max players</Label>
          <Input
            id="event-max"
            type="number"
            min={2}
            max={64}
            required
            value={maxMembers}
            onChange={(e) => setMaxMembers(e.target.value)}
          />
        </div>
        {venues.length > 1 ? (
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="event-venue">Venue</Label>
            <select
              id="event-venue"
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={pending}>
            Create event
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </form>

      <div className="admin-dashboard-card space-y-3">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        ) : (
          events.map((event) => (
            <article
              key={event.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{event.title}</h3>
                  {event.closed ? <Badge variant="secondary">Closed</Badge> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {event.startsAt ? new Date(event.startsAt).toLocaleString() : "No time set"} · {event.memberCount}/
                  {event.maxMembers ?? "∞"} joined
                </p>
              </div>
              {!event.closed ? (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => close(event.id)}>
                  Close
                </Button>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  )
}
