"use client"

import Link from "next/link"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type {
  BookingTimeline,
  TimelineCategory,
  TimelineEvent,
} from "@/server/operations/timeline-types"

const categoryLabels: Record<TimelineCategory, string> = {
  payment: "Payment",
  booking: "Booking",
  session: "Session",
  worker: "Worker",
  device: "Device",
  replay: "Replay",
  media: "Media",
  access: "Access",
  audit: "Audit",
}

function categoryVariant(category: TimelineCategory) {
  switch (category) {
    case "payment":
    case "booking":
      return "default" as const
    case "session":
    case "worker":
      return "secondary" as const
    case "device":
    case "replay":
    case "media":
      return "outline" as const
    case "access":
    case "audit":
      return "secondary" as const
  }
}

function TimelineEventRow({ event }: { event: TimelineEvent }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!event.correlationId) {
      return
    }

    await navigator.clipboard.writeText(event.correlationId)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <article className="relative pl-8">
      <div className="absolute left-[0.4375rem] top-2 size-2 rounded-full bg-primary" />
      <div className="rounded-xl border border-border/70 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{event.label}</p>
          <Badge variant={categoryVariant(event.category)}>
            {categoryLabels[event.category]}
          </Badge>
          {event.status ? <Badge variant="outline">{event.status}</Badge> : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {new Date(event.occurredAt).toLocaleString()} · {event.entityType} ·{" "}
          {event.entityId}
        </p>
        {event.detail ? (
          <p className="mt-2 text-sm text-muted-foreground">{event.detail}</p>
        ) : null}
        {event.correlationId ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 text-xs">
              {event.correlationId}
            </code>
            <Button type="button" size="sm" variant="ghost" onClick={handleCopy}>
              {copied ? "Copied" : "Copy correlation ID"}
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  )
}

export function AdminBookingTimeline({ timeline }: { timeline: BookingTimeline }) {
  const { summary, events, accessConfigured } = timeline

  return (
    <div className="space-y-6">
      <section className="admin-dashboard-card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{summary.userName}</h2>
            <p className="text-sm text-muted-foreground">{summary.userEmail}</p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/venues/${summary.locationId}`}>Venue detail</Link>
          </Button>
        </div>

        <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Venue</p>
            <p className="font-medium">{summary.locationName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Table</p>
            <p className="font-medium">{summary.resourceName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Window</p>
            <p className="font-medium">
              {new Date(summary.startTime).toLocaleString()} –{" "}
              {new Date(summary.endTime).toLocaleTimeString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Total</p>
            <p className="font-medium">
              {summary.currency} {summary.totalAmount}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{summary.status}</Badge>
          <Badge variant="secondary">{summary.paymentStatus}</Badge>
          {summary.playSessionStatus ? (
            <Badge variant="outline">Session: {summary.playSessionStatus}</Badge>
          ) : (
            <Badge variant="secondary">No play session yet</Badge>
          )}
        </div>

        {summary.correlationIds.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Correlation IDs</p>
            <div className="flex flex-wrap gap-2">
              {summary.correlationIds.map((correlationId) => (
                <code
                  key={correlationId}
                  className="rounded bg-muted px-2 py-1 text-xs"
                >
                  {correlationId}
                </code>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {!accessConfigured ? (
        <section className="admin-dashboard-card">
          <p className="text-sm text-muted-foreground">
            Access and TTLock automation events are not configured yet. They will
            appear here once Phase 5 ships or when session automation events exist.
          </p>
        </section>
      ) : null}

      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Operational timeline</h3>
          <p className="text-sm text-muted-foreground">
            Payment, session, worker, device, replay, and media events in order.
          </p>
        </div>

        {events.length === 0 ? (
          <div className="admin-dashboard-card">
            <p className="text-sm text-muted-foreground">
              No timeline events are recorded for this booking yet.
            </p>
          </div>
        ) : (
          <div className="relative space-y-4 border-l border-border/70 pl-4">
            {events.map((event) => (
              <TimelineEventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
