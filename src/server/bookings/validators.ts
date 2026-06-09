import { z } from "zod/v3";

import {
  BOOKING_DURATION_OPTIONS,
  GROUP_SIZE_OPTIONS,
} from "@/server/bookings/constants";

const groupSizeSchema = z.union([
  z.literal(GROUP_SIZE_OPTIONS[0]),
  z.literal(GROUP_SIZE_OPTIONS[1]),
  ...GROUP_SIZE_OPTIONS.slice(2).map((value) => z.literal(value)),
] as const);

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
  groupSize: groupSizeSchema,
});

export const createPendingBookingSchema = bookingQuoteInputSchema.extend({
  userId: z.string().min(1, "You must be signed in to create a booking."),
  notes: z.string().max(300).optional(),
});

export const createBookingBodySchema = bookingQuoteInputSchema.extend({
  notes: z.string().max(300).optional(),
});

export const locationAvailabilityInputSchema = z.object({
  locationId: z.string().uuid("Location is required."),
  date: z.string().min(1, "Date is required."),
  durationMinutes: z.union([
    z.literal(BOOKING_DURATION_OPTIONS[0]),
    z.literal(BOOKING_DURATION_OPTIONS[1]),
  ]),
  groupSize: groupSizeSchema,
});
