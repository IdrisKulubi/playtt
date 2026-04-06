import { z } from "zod/v3";

import {
  BOOKING_DURATION_OPTIONS,
  GROUP_SIZE_OPTIONS,
} from "@/server/bookings/constants";

export const availabilityInputSchema = z.object({
  resourceId: z.string().uuid("Resource is required."),
  date: z.string().min(1, "Date is required."),
  durationMinutes: z.union([
    z.literal(BOOKING_DURATION_OPTIONS[0]),
    z.literal(BOOKING_DURATION_OPTIONS[1]),
  ]),
});

export const bookingQuoteInputSchema = z.object({
  locationId: z.string().uuid("Location is required."),
  resourceId: z.string().uuid("Resource is required."),
  startTimeIso: z.string().datetime("Start time is required."),
  durationMinutes: z.union([
    z.literal(BOOKING_DURATION_OPTIONS[0]),
    z.literal(BOOKING_DURATION_OPTIONS[1]),
  ]),
  groupSize: z.union(
    GROUP_SIZE_OPTIONS.map((value) => z.literal(value)) as [
      z.ZodLiteral<(typeof GROUP_SIZE_OPTIONS)[number]>,
      ...z.ZodLiteral<(typeof GROUP_SIZE_OPTIONS)[number]>[],
    ],
  ),
});

export const createPendingBookingSchema = bookingQuoteInputSchema.extend({
  userId: z.string().min(1, "You must be signed in to create a booking."),
  notes: z.string().max(300).optional(),
});

export const locationAvailabilityInputSchema = z.object({
  locationId: z.string().uuid("Location is required."),
  date: z.string().min(1, "Date is required."),
  durationMinutes: z.union([
    z.literal(BOOKING_DURATION_OPTIONS[0]),
    z.literal(BOOKING_DURATION_OPTIONS[1]),
  ]),
  groupSize: z.union(
    GROUP_SIZE_OPTIONS.map((value) => z.literal(value)) as [
      z.ZodLiteral<(typeof GROUP_SIZE_OPTIONS)[number]>,
      ...z.ZodLiteral<(typeof GROUP_SIZE_OPTIONS)[number]>[],
    ],
  ),
});
