import { addMinutes } from "date-fns";

import {
  BOOKING_SLOT_INTERVAL_MINUTES,
  DEFAULT_PENDING_BOOKING_WINDOW_MINUTES,
} from "@/server/bookings/constants";

export {
  buildDaySlots,
  getZonedDay,
  getZonedHours,
  isSlotClosedForBooking,
  sameBookingDay,
  zonedWallTime,
} from "./day-slots.mjs";

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
