"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CheckCircleIcon,
  CopyIcon,
  DoorIcon,
  EyeIcon,
  SpinnerGapIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type {
  BookingAccessReveal,
  BookingAccessStatus,
} from "@/server/access/player-contract"

type ApiPayload<T> = { data?: T; message?: string }

const stateLabels: Record<BookingAccessStatus["status"], string> = {
  configuring: "Configuring",
  ready: "Ready",
  temporarily_unavailable: "Temporarily unavailable",
  action_required: "Action required",
  revoking: "Revoking",
  revoked: "Revoked",
  expired: "Expired",
  not_eligible: "Not eligible",
}

function formatAccessTime(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function BookingAccessCard({ bookingId }: { bookingId: string }) {
  const [access, setAccess] = useState<BookingAccessStatus | null>(null)
  const [revealed, setRevealed] = useState<BookingAccessReveal | null>(null)
  const [loading, setLoading] = useState(true)
  const [revealing, setRevealing] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setRevealed(null)
    try {
      const response = await fetch(`/api/bookings/${bookingId}/access`, {
        cache: "no-store",
        credentials: "same-origin",
      })
      const payload = (await response.json()) as ApiPayload<{
        access: BookingAccessStatus
      }>
      if (!response.ok || !payload.data?.access) {
        throw new Error(payload.message ?? "Could not load venue access.")
      }
      setAccess(payload.data.access)
    } catch (error) {
      setAccess(null)
      toast.error(
        error instanceof Error ? error.message : "Could not load venue access.",
      )
    } finally {
      setLoading(false)
    }
  }, [bookingId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function revealCode() {
    setRevealing(true)
    try {
      const response = await fetch(`/api/bookings/${bookingId}/access/reveal`, {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
      })
      const payload = (await response.json()) as ApiPayload<BookingAccessReveal>
      if (!response.ok || !payload.data) {
        throw new Error(payload.message ?? "The access code is not available.")
      }
      setRevealed(payload.data)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not reveal access code.",
      )
      await refresh()
    } finally {
      setRevealing(false)
    }
  }

  async function copyCode() {
    if (!revealed) return
    try {
      await navigator.clipboard.writeText(revealed.code)
      toast.success("Access code copied.")
    } catch {
      toast.error("Could not copy the access code.")
    }
  }

  if (loading) {
    return (
      <section className="quiet-panel flex items-center gap-3 bg-[var(--background-elevated)] p-5">
        <SpinnerGapIcon className="size-5 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Checking venue access…</p>
      </section>
    )
  }

  if (!access) return null

  const isReady = access.status === "ready"
  const needsHelp =
    access.status === "temporarily_unavailable" ||
    access.status === "action_required"

  return (
    <section className="quiet-panel bg-[var(--background-elevated)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-label">Venue access</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">
            Your door code
          </h2>
        </div>
        <Badge variant={isReady ? "default" : "outline"}>
          {stateLabels[access.status]}
        </Badge>
      </div>

      <div className="mt-5 flex gap-3 rounded-[var(--radius-field)] border border-border bg-card p-4">
        {isReady ? (
          <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-primary" weight="fill" />
        ) : needsHelp ? (
          <WarningCircleIcon className="mt-0.5 size-5 shrink-0 text-amber-600" weight="fill" />
        ) : (
          <DoorIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        )}
        <p className="text-sm leading-6 text-muted-foreground">
          {access.supportMessage ?? "Your venue access status is up to date."}
        </p>
      </div>

      {access.doors.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Doors in order
          </p>
          <ol className="mt-2 grid gap-2 sm:grid-cols-2">
            {access.doors.map((door, index) => (
              <li
                key={door.accessPointId}
                className="flex items-center gap-3 rounded-[var(--radius-field)] border border-border bg-card px-4 py-3 text-sm"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                {door.name}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {access.validFrom && access.validUntil ? (
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Works from</dt>
            <dd className="mt-1 font-medium">{formatAccessTime(access.validFrom)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Works until</dt>
            <dd className="mt-1 font-medium">{formatAccessTime(access.validUntil)}</dd>
          </div>
        </dl>
      ) : null}

      {revealed ? (
        <div className="mt-5 rounded-[var(--radius-field)] border border-primary/30 bg-primary/8 p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Enter at each listed door
          </p>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-[0.24em] text-foreground">
            {revealed.code}
          </p>
          <Button className="mt-4" variant="outline" size="sm" onClick={() => void copyCode()}>
            <CopyIcon className="size-4" />
            Copy code
          </Button>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {access.revealable && !revealed ? (
          <Button size="sm" onClick={() => void revealCode()} disabled={revealing}>
            {revealing ? (
              <SpinnerGapIcon className="size-4 animate-spin" />
            ) : (
              <EyeIcon className="size-4" />
            )}
            Reveal code
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          Refresh status
        </Button>
        {needsHelp ? (
          <Button asChild variant="outline" size="sm">
            <a href="/account/help">Contact support</a>
          </Button>
        ) : null}
      </div>
    </section>
  )
}
