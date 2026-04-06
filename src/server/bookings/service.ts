import { parseISO } from "date-fns";

import {
  buildDateTimeRange,
  buildDaySlots,
  getPendingBookingExpiry,
  roundDateToSlot,
  sameBookingDay,
} from "@/server/bookings/utils";
import { calculateBookingQuote } from "@/server/bookings/pricing";
import {
  ensureUserExists,
  findBlockingBookings,
  findBlockingBookingsForResources,
  getResourceContext,
  insertPendingBooking,
  listActiveResourcesByLocation,
  listActiveLocationsWithResources,
} from "@/server/bookings/repository";
import type {
  BookingQuote,
  CreatePendingBookingInput,
  CreatePendingBookingResult,
  LocationSummary,
  SlotAvailability,
} from "@/server/bookings/types";
import {
  bookingQuoteInputSchema,
  createPendingBookingSchema,
  locationAvailabilityInputSchema,
} from "@/server/bookings/validators";

export async function getBookingBootstrapData(): Promise<{
  locations: LocationSummary[];
}> {
  const activeLocations = await listActiveLocationsWithResources();
  return { locations: activeLocations };
}

export async function getBookingQuote(input: unknown): Promise<BookingQuote> {
  const parsed = bookingQuoteInputSchema.parse(input);
  const resourceContext = await getResourceContext(parsed);

  if (!resourceContext) {
    throw new Error("The selected location or resource is unavailable.");
  }

  const { start, end } = buildDateTimeRange(
    parsed.startTimeIso,
    parsed.durationMinutes,
  );

  return calculateBookingQuote({
    locationId: parsed.locationId,
    resourceId: parsed.resourceId,
    start,
    end,
    durationMinutes: parsed.durationMinutes,
    groupSize: parsed.groupSize,
  });
}

export async function getLocationAvailability(
  input: unknown,
): Promise<SlotAvailability[]> {
  const parsed = locationAvailabilityInputSchema.parse(input);
  const day = parseISO(`${parsed.date}T00:00:00`);

  if (Number.isNaN(day.getTime())) {
    throw new Error("Invalid availability date.");
  }

  const activeResources = await listActiveResourcesByLocation(parsed.locationId);

  if (activeResources.length === 0) {
    return [];
  }

  const slots = buildDaySlots(day, parsed.durationMinutes);
  const blockingBookings = await findBlockingBookingsForResources({
    resourceIds: activeResources.map((resource) => resource.id),
    start: slots[0]?.startsAt ?? day,
    end: slots.at(-1)?.endsAt ?? day,
  });

  return slots.map((slot) => {
    const availableResourceIds = activeResources
      .filter(
        (resource) =>
          !blockingBookings.some(
            (booking) =>
              booking.resourceId === resource.id &&
              booking.startTime < slot.endsAt &&
              booking.endTime > slot.startsAt,
          ),
      )
      .map((resource) => resource.id);

    const isAvailable = availableResourceIds.length > 0;
    const quote = calculateBookingQuote({
      locationId: parsed.locationId,
      resourceId: availableResourceIds[0] ?? activeResources[0].id,
      start: slot.startsAt,
      end: slot.endsAt,
      durationMinutes: parsed.durationMinutes,
      groupSize: parsed.groupSize,
    });

    return {
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      durationMinutes: parsed.durationMinutes,
      isAvailable,
      openTableCount: availableResourceIds.length,
      availableResourceIds,
      price: {
        currency: quote.currency,
        subtotalAmount: quote.subtotalAmount,
        discountAmount: quote.discountAmount,
        totalAmount: quote.totalAmount,
        pricingRuleSnapshot: quote.pricingRuleSnapshot,
      },
    };
  });
}

export async function createPendingBooking(
  input: unknown,
): Promise<CreatePendingBookingResult> {
  const parsed = createPendingBookingSchema.parse(input);
  const resourceContext = await getResourceContext(parsed);

  if (!resourceContext) {
    throw new Error("The selected location or resource is unavailable.");
  }

  const existingUser = await ensureUserExists(parsed.userId);

  if (!existingUser) {
    throw new Error("You must be signed in with a valid account.");
  }

  const { start, end } = buildDateTimeRange(
    parsed.startTimeIso,
    parsed.durationMinutes,
  );

  const roundedStart = roundDateToSlot(start);

  if (roundedStart.toISOString() !== start.toISOString()) {
    throw new Error("Bookings must start on a 30-minute boundary.");
  }

  if (sameBookingDay(start) !== sameBookingDay(end)) {
    throw new Error("Bookings must start and end on the same day.");
  }

  if (start <= new Date()) {
    throw new Error("Bookings must be made for a future time.");
  }

  const blockingBookings = await findBlockingBookings({
    resourceId: parsed.resourceId,
    start,
    end,
  });

  if (blockingBookings.length > 0) {
    throw new Error("That time slot is no longer available.");
  }

  const quote = calculateBookingQuote({
    locationId: parsed.locationId,
    resourceId: parsed.resourceId,
    start,
    end,
    durationMinutes: parsed.durationMinutes,
    groupSize: parsed.groupSize,
  });

  return insertPendingBooking({
    booking: {
      ...parsed,
      notes:
        parsed.notes ||
        `Group size: ${parsed.groupSize}`,
      start,
      end,
      currency: quote.currency,
      subtotalAmount: quote.subtotalAmount.toFixed(2),
      discountAmount: quote.discountAmount.toFixed(2),
      totalAmount: quote.totalAmount.toFixed(2),
      pricingRuleSnapshot: quote.pricingRuleSnapshot,
      expiresAt: getPendingBookingExpiry(),
    },
  });
}
