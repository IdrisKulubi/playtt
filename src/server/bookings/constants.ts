export const BOOKING_DURATION_OPTIONS = [30, 60] as const;

export const BOOKING_STATUSES_BLOCKING = ["pending", "confirmed"] as const;

export const DEFAULT_BOOKING_CURRENCY = "KES";

export const DEFAULT_PENDING_BOOKING_WINDOW_MINUTES = 10;

export const BOOKING_SLOT_INTERVAL_MINUTES = 30;

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
