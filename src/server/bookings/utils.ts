import {
  addMinutes,
  format,
  isAfter,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  startOfDay,
} from "date-fns";

import {
  BOOKING_SLOT_INTERVAL_MINUTES,
  DEFAULT_PENDING_BOOKING_WINDOW_MINUTES,
} from "@/server/bookings/constants";

export function roundDateToSlot(date: Date) {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const roundedMinutes =
    Math.ceil(minutes / BOOKING_SLOT_INTERVAL_MINUTES) *
    BOOKING_SLOT_INTERVAL_MINUTES;

  rounded.setMinutes(roundedMinutes, 0, 0);
  return rounded;
}

export function buildDateTimeRange(startTimeIso: string, durationMinutes: number) {
  const start = new Date(startTimeIso);

  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid booking start time.");
  }

  const end = addMinutes(start, durationMinutes);
  return { start, end };
}

export function getPendingBookingExpiry() {
  return addMinutes(new Date(), DEFAULT_PENDING_BOOKING_WINDOW_MINUTES);
}

export function buildDaySlots(date: Date, durationMinutes: number) {
  const slots: { startsAt: Date; endsAt: Date }[] = [];
  let current = setMilliseconds(setSeconds(setMinutes(setHours(startOfDay(date), 8), 0), 0), 0);
  const closing = setMilliseconds(
    setSeconds(setMinutes(setHours(startOfDay(date), 22), 0), 0),
    0,
  );

  while (!isAfter(addMinutes(current, durationMinutes), closing)) {
    slots.push({
      startsAt: current,
      endsAt: addMinutes(current, durationMinutes),
    });
    current = addMinutes(current, BOOKING_SLOT_INTERVAL_MINUTES);
  }

  return slots;
}

export function sameBookingDay(date: Date) {
  return format(date, "yyyy-MM-dd");
}
