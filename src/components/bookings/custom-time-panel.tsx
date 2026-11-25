"use client"

import { useState } from "react"
import { format } from "date-fns"

import {
  describeSuggestion,
  formatDurationLabel,
} from "@/components/bookings/booking-utils"
import { Button } from "@/components/ui/button"
import type { BookingPlan, BookingSuggestion } from "@/server/bookings/types"

interface CustomTimePanelProps {
  /** Pre-fills the time box, e.g. "11:50". */
  defaultTime: string
  minTime?: string
  durationMinutes: number
  plan: BookingPlan | null
  isChecking: boolean
  onCheck: (time: string) => void
  onBookRequested: () => void
  onPickSuggestion: (suggestion: BookingSuggestion) => void
}

const t = (iso: string) => format(new Date(iso), "h:mm a")

/**
 * "Pick your own time": any 5-minute start. We check it against every table
 * and, when it clashes, say when the table is busy and offer the nearest times.
 */
export function CustomTimePanel({
  defaultTime,
  minTime,
  durationMinutes,
  plan,
  isChecking,
  onCheck,
  onBookRequested,
  onPickSuggestion,
}: CustomTimePanelProps) {
  const [time, setTime] = useState(defaultTime)

  return (
    <div className="mx-5 mt-4 rounded-[var(--radius-field)] border border-border px-4 py-4 sm:mx-6">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (time) onCheck(time)
        }}
      >
        <label className="min-w-[9rem] flex-1">
          <span className="text-xs font-semibold text-muted-foreground">
            Your start time
          </span>
          <input
            type="time"
            step={300}
            min={minTime}
            value={time}
            onChange={(event) => setTime(event.target.value)}
            className="surface-inset mt-1 w-full rounded-[var(--radius-field)] border border-border px-3 py-2.5 text-base font-semibold text-foreground tabular-nums"
          />
        </label>
        <Button type="submit" disabled={!time || isChecking}>
          {isChecking ? "Checking…" : `Check ${formatDurationLabel(durationMinutes)}`}
        </Button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">
        Any start in 5-minute steps, like 11:50.
      </p>

      {plan ? (
        <div className="mt-4 space-y-3" aria-live="polite">
          {plan.status === "available" && plan.price ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {t(plan.requested.startsAt)} – {t(plan.requested.endsAt)} is free
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {plan.price.currency} {plan.price.totalAmount.toLocaleString()}
                </p>
              </div>
              <Button onClick={onBookRequested}>Book this time</Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-foreground">
                {plan.status === "past"
                  ? `${t(plan.requested.startsAt)} has already passed. The soonest you can start is ${t(plan.earliestStartIso)}.`
                  : `You wanted ${t(plan.requested.startsAt)} – ${t(plan.requested.endsAt)}, but ${
                      plan.conflicts.length > 0
                        ? `another group has the table ${plan.conflicts
                            .map((c) => `${t(c.startsAt)} – ${t(c.endsAt)}`)
                            .join(" and ")}`
                        : "every table is taken then"
                    }.`}
              </p>
              {plan.suggestions.length > 0 ? (
                <>
                  <p className="text-xs font-semibold text-muted-foreground">
                    You can have one of these instead
                  </p>
                  <ul className="divide-y divide-border rounded-[var(--radius-field)] border border-border">
                    {plan.suggestions.map((suggestion) => (
                      <li key={`${suggestion.startsAt}-${suggestion.durationMinutes}`}>
                        <button
                          type="button"
                          onClick={() => onPickSuggestion(suggestion)}
                          className="booking-slot-row"
                        >
                          <span className="min-w-[8.5rem] text-sm font-semibold text-foreground tabular-nums">
                            {t(suggestion.startsAt)} – {t(suggestion.endsAt)}
                          </span>
                          <span className="flex-1 text-xs text-muted-foreground">
                            {describeSuggestion(suggestion)}
                          </span>
                          <span className="text-sm font-semibold text-foreground tabular-nums">
                            {suggestion.price.currency}{" "}
                            {suggestion.price.totalAmount.toLocaleString()}
                          </span>
                          <span className="text-sm font-semibold text-primary">
                            Take it
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nothing close is free this day. Try another day or a shorter game.
                </p>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
