"use client"

import { format, isSameDay, isToday } from "date-fns"
import { ArrowLeftIcon, MapPinIcon } from "@phosphor-icons/react"

import { SlotRow } from "@/components/bookings/slot-row"
import { Button } from "@/components/ui/button"
import type { LocationSummary, SlotAvailability } from "@/server/bookings/types"

interface TimingPanelProps {
  location: LocationSummary | null
  selectedDate: string
  selectedDay: Date
  dateStripDays: Date[]
  showExtendedDates: boolean
  showDatePicker: boolean
  durationMinutes: 30 | 60
  slots: SlotAvailability[]
  selectedSlot: SlotAvailability | null
  isPending: boolean
  nowMs: number
  canChangeVenue: boolean
  onBack: () => void
  onDateChange: (value: string) => void
  onShowExtendedDates: () => void
  onShowDatePicker: () => void
  onDurationChange: (value: 30 | 60) => void
  onSlotSelect: (slot: SlotAvailability) => void
}

export function TimingPanel({
  location,
  selectedDate,
  selectedDay,
  dateStripDays,
  showExtendedDates,
  showDatePicker,
  durationMinutes,
  slots,
  selectedSlot,
  isPending,
  nowMs,
  canChangeVenue,
  onBack,
  onDateChange,
  onShowExtendedDates,
  onShowDatePicker,
  onDurationChange,
  onSlotSelect,
}: TimingPanelProps) {
  return (
    <section className="booking-stage booking-timing-stage">
      <div className="booking-stage__intro">
        <div>
          <p className="booking-stage__eyebrow">Step 1 of 3</p>
          <h2>When do you want to play?</h2>
          <p>Choose a day and an available time.</p>
        </div>
        {canChangeVenue ? (
          <Button
            variant="ghost"
            size="sm"
            className="booking-venue-change"
            onClick={onBack}
          >
            <ArrowLeftIcon className="size-4" />
            Change venue
          </Button>
        ) : null}
      </div>

      <div className="booking-venue-chip">
        <MapPinIcon className="size-4" weight="fill" />
        <span>{location?.name ?? "Your venue"}</span>
        {location?.address ? (
          <small>{location.address}</small>
        ) : null}
      </div>

      <div className="mt-5 overflow-x-auto px-5 pb-1 sm:px-6">
        <div className="flex min-w-max items-end gap-0">
          {dateStripDays.map((d) => {
            const key = format(d, "yyyy-MM-dd")
            const sel = isSameDay(d, selectedDay)

            return (
              <button
                key={key}
                type="button"
                onClick={() => onDateChange(key)}
                className={`booking-date-tab ${sel ? "booking-date-tab--active" : ""}`}
              >
                <span className="booking-date-tab__dot" aria-hidden />
                {isToday(d) ? "Today" : format(d, "EEE, M/d")}
              </button>
            )
          })}
          {!showExtendedDates ? (
            <button
              type="button"
              onClick={onShowExtendedDates}
              className="booking-date-tab shrink-0 text-primary"
            >
              <span className="booking-date-tab__dot" aria-hidden />
              More
            </button>
          ) : null}
        </div>
      </div>

      <div className="px-5 pt-5 sm:px-6">
        <div
          className="segmented-control"
          role="group"
          aria-label="Session duration"
        >
          <button
            type="button"
            onClick={() => onDurationChange(30)}
            className={`segmented-control__item ${durationMinutes === 30 ? "segmented-control__item--active" : ""}`}
          >
            30 min
          </button>
          <button
            type="button"
            onClick={() => onDurationChange(60)}
            className={`segmented-control__item ${durationMinutes === 60 ? "segmented-control__item--active" : ""}`}
          >
            60 min
          </button>
        </div>
      </div>

      {showDatePicker ? (
        <div className="px-5 pt-3 sm:px-6">
          <label className="sr-only" htmlFor="booking-date-fallback">
            Pick a date
          </label>
          <input
            id="booking-date-fallback"
            type="date"
            value={selectedDate}
            onChange={(event) => onDateChange(event.target.value)}
            className="surface-inset w-full rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={onShowDatePicker}
          className="px-5 pt-3 text-xs font-medium text-primary hover:underline sm:px-6"
        >
          Choose another date
        </button>
      )}

      <div className="booking-slots-heading">
        <span>Available times</span>
        <span>{durationMinutes} min sessions</span>
      </div>
      <ul className="booking-slot-list mx-5 mt-3 max-h-[min(26rem,52vh)] overflow-y-auto sm:mx-6 sm:max-h-[min(30rem,58vh)]">
        {slots.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            {isPending ? "Loading…" : "No times this day."}
          </li>
        ) : (
          slots.map((slot) => {
            const selected = selectedSlot?.startsAt === slot.startsAt
            const startInPast = new Date(slot.startsAt).getTime() <= nowMs
            const rowDisabled = !slot.isAvailable || isPending || startInPast

            return (
              <SlotRow
                key={slot.startsAt}
                slot={slot}
                selected={selected}
                disabled={rowDisabled}
                nowMs={nowMs}
                onSelect={() => onSlotSelect(slot)}
              />
            )
          })
        )}
      </ul>
    </section>
  )
}
