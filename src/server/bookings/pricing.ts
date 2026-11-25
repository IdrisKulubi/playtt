import {
  BASE_GROUP_SIZE,
  DEFAULT_BOOKING_CURRENCY,
  DEFAULT_VENUE_TIMEZONE,
  EXTRA_PLAYER_SURCHARGE,
  OFF_PEAK_RATE_PER_30_MINUTES,
  PEAK_PRICING_WINDOWS,
} from "@/server/bookings/constants";
import { getZonedDay, getZonedHours } from "@/server/bookings/utils";
import type { BookingQuote } from "@/server/bookings/types";

export function calculateBookingQuote(input: {
  locationId: string;
  resourceId: string;
  start: Date;
  end: Date;
  durationMinutes: number;
  groupSize: number;
  timeZone?: string;
}): BookingQuote {
  const timeZone = input.timeZone ?? DEFAULT_VENUE_TIMEZONE;
  // Each 30-minute block is priced by the rate when it starts, so a 3-hour
  // game from 4:30 PM pays off-peak until 5 PM and peak after.
  const units = Math.max(1, Math.ceil(input.durationMinutes / 30));
  const blocks = Array.from({ length: units }, (_, index) =>
    resolvePricingWindow(
      new Date(input.start.getTime() + index * 30 * 60 * 1000),
      timeZone,
    ),
  );
  const subtotalAmount = blocks.reduce(
    (sum, block) => sum + block.ratePer30Minutes,
    0,
  );
  const tierLabels = Array.from(new Set(blocks.map((block) => block.label)));
  const pricingWindow = blocks[0];
  const peakBlocks = blocks.filter((block) => block.label !== "off_peak").length;
  const extraPlayers = Math.max(0, input.groupSize - BASE_GROUP_SIZE);
  const surchargeAmount = extraPlayers * EXTRA_PLAYER_SURCHARGE;
  const discountAmount = 0;
  const totalAmount = subtotalAmount + surchargeAmount - discountAmount;

  return {
    locationId: input.locationId,
    resourceId: input.resourceId,
    groupSize: input.groupSize,
    durationMinutes: input.durationMinutes,
    startTimeIso: input.start.toISOString(),
    endTimeIso: input.end.toISOString(),
    currency: DEFAULT_BOOKING_CURRENCY,
    subtotalAmount,
    surchargeAmount,
    discountAmount,
    totalAmount,
    pricingRuleSnapshot: {
      pricingTier: tierLabels.length === 1 ? pricingWindow.label : "peak_and_off_peak",
      ratePer30Minutes: pricingWindow.ratePer30Minutes,
      blocks: units,
      peakBlocks,
      offPeakBlocks: units - peakBlocks,
      includedPlayers: BASE_GROUP_SIZE,
      groupSize: input.groupSize,
      extraPlayers,
      surchargePerExtraPlayer: EXTRA_PLAYER_SURCHARGE,
      surchargeAmount,
      computedAt: new Date().toISOString(),
    },
  };
}

function resolvePricingWindow(start: Date, timeZone: string) {
  const day = getZonedDay(start, timeZone);
  const hour = getZonedHours(start, timeZone);

  const peakWindow =
    PEAK_PRICING_WINDOWS.find(
      (window) =>
        window.days.some((allowedDay) => allowedDay === day) &&
        hour >= window.startHour &&
        hour < window.endHour,
    ) ?? null;

  if (peakWindow) {
    return peakWindow;
  }

  return {
    label: "off_peak",
    ratePer30Minutes: OFF_PEAK_RATE_PER_30_MINUTES,
  };
}
