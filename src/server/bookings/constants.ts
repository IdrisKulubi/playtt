export const BOOKING_DURATION_OPTIONS = [30, 60, 90, 120, 180] as const;

export type BookingDurationMinutes = (typeof BOOKING_DURATION_OPTIONS)[number];

export const BOOKING_STATUSES_BLOCKING = ["pending", "confirmed"] as const;

export const DEFAULT_BOOKING_CURRENCY = "KES";

export const DEFAULT_PENDING_BOOKING_WINDOW_MINUTES = 10;

/** Spacing of the quick-pick times shown in the time list. */
export const BOOKING_SLOT_INTERVAL_MINUTES = 30;

/** Custom start times can be any 5-minute step (11:50, 11:55, ...). */
export const BOOKING_START_STEP_MINUTES = 5;

/** A start up to a minute behind "now" still counts, to cover request latency. */
export const BOOKING_START_GRACE_MS = 60 * 1000;

export const DEFAULT_VENUE_TIMEZONE = "Africa/Nairobi";

export const PEAK_PRICING_WINDOWS = [
  {
    label: "weekday_evening_peak",
    days: [1, 2, 3, 4, 5],
    startHour: 17,
    endHour: 21,
    ratePer30Minutes: 1200,
  },
  {
    label: "weekend_peak",
    days: [0, 6],
    startHour: 9,
    endHour: 21,
    ratePer30Minutes: 1200,
  },
] as const;

export const OFF_PEAK_RATE_PER_30_MINUTES = 800;

export const BASE_GROUP_SIZE = 5;

export const EXTRA_PLAYER_SURCHARGE = 500;

export const GROUP_SIZE_OPTIONS = [2, 3, 4, 5, 6, 7, 8] as const;

export const BOOKING_EDIT_CUTOFF_HOURS = 2;
