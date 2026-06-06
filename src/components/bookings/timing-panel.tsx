"use client";

import { addDays, format, isSameDay, isToday, startOfDay } from "date-fns";
import { ArrowLeftIcon } from "@phosphor-icons/react";

import { SlotRow } from "@/components/bookings/slot-row";
import { Button } from "@/components/ui/button";
import type { LocationSummary, SlotAvailability } from "@/server/bookings/types";

interface TimingPanelProps {
  location: LocationSummary | null;
  selectedDate: string;
  selectedDay: Date;
  dateStripDays: Date[];
  showExtendedDates: boolean;
  showDatePicker: boolean;
  durationMinutes: 30 | 60;
  slots: SlotAvailability[];
  selectedSlot: SlotAvailability | null;
  isPending: boolean;
  onBack: () => void;
  onDateChange: (value: string) => void;
  onShowExtendedDates: () => void;
  onShowDatePicker: () => void;
  onDurationChange: (value: 30 | 60) => void;
  onSlotSelect: (slot: SlotAvailability) => void;
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
  onBack,
  onDateChange,
  onShowExtendedDates,
  onShowDatePicker,
  onDurationChange,
  onSlotSelect,
}: TimingPanelProps) {
  return (
    <section className="booking-stage mx-auto w-full max-w-lg sm:max-w-xl">
      <div className="product-shell-header flex items-center gap-2 px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 rounded-full"
          onClick={onBack}
          aria-label="Back to venues"
        >
          <ArrowLeftIcon className="size-5" />
        </Button>
        <h2 className="min-w-0 flex-1 truncate text-center text-base font-semibold text-foreground">
          {location?.name ?? "Select time"}
        </h2>
        <span className="size-9 shrink-0" aria-hidden />
      </div>

      <div className="-mx-1 mt-2 overflow-x-auto px-4 pb-1">
        <div className="flex min-w-max items-end gap-0">
          {dateStripDays.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const sel = isSameDay(d, selectedDay);

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
            );
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

      <div className="px-4 pt-4">
        <div className="segmented-control" role="group" aria-label="Session duration">
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
        <div className="px-4 pt-3">
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
          className="px-4 pt-3 text-xs text-primary hover:underline"
        >
          Choose another date
        </button>
      )}

      <ul className="booking-slot-list mx-4 mt-4 max-h-[min(26rem,52vh)] overflow-y-auto sm:max-h-[min(30rem,58vh)]">
        {slots.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            {isPending ? "Loading…" : "No times this day."}
          </li>
        ) : (
          slots.map((slot) => {
            const selected = selectedSlot?.startsAt === slot.startsAt;
            const startInPast =
              new Date(slot.startsAt).getTime() <= Date.now();
            const rowDisabled = !slot.isAvailable || isPending || startInPast;

            return (
              <SlotRow
                key={slot.startsAt}
                slot={slot}
                selected={selected}
                disabled={rowDisabled}
                onSelect={() => onSlotSelect(slot)}
              />
            );
          })
        )}
      </ul>
    </section>
  );
}
