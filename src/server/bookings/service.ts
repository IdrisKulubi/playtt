import { parseISO } from "date-fns"

import {
  buildDateTimeRange,
  buildDaySlots,
  getPendingBookingExpiry,
  roundDateToSlot,
  sameBookingDay,
} from "@/server/bookings/utils"
import { calculateBookingQuote } from "@/server/bookings/pricing"
import {
  ensureUserExists,
  findBlockingBookings,
  findBlockingBookingsForResources,
  getResourceContext,
  getUserBookingById,
  insertPendingBooking,
  listActiveResourcesByLocation,
  listActiveLocationsWithResources,
  listUserBookings,
  type BookingListFilter,
} from "@/server/bookings/repository"
import { runBookingExpirySweep } from "@/server/payments/service"
import type {
  BookingQuote,
  CreatePendingBookingResult,
  LocationSummary,
  SlotAvailability,
  UserBookingSummary,
} from "@/server/bookings/types"
import { getEditEligibility } from "@/server/bookings/modifications/eligibility"
import {
  bookingQuoteInputSchema,
  createPendingBookingSchema,
  locationAvailabilityInputSchema,
} from "@/server/bookings/validators"
import { isBookingOverlapConflict } from "@/server/bookings/database-errors"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import type { TenantContext } from "@/server/tenancy/types"

export async function getBookingBootstrapData(
  context: TenantContext,
): Promise<{
  locations: LocationSummary[]
}> {
  authorize(context, "venue.read")
  const activeLocations = await listActiveLocationsWithResources(context)
  return { locations: activeLocations }
}

export async function getBookingQuote(
  context: TenantContext,
  input: unknown,
): Promise<BookingQuote> {
  authorize(context, "booking.read")
  const parsed = bookingQuoteInputSchema.parse(input)
  const resourceContext = await getResourceContext(context, parsed)

  if (!resourceContext) {
    throw new Error("The selected location or resource is unavailable.")
  }

  const { start, end } = buildDateTimeRange(
    parsed.startTimeIso,
    parsed.durationMinutes,
  )

  if (start <= new Date()) {
    throw new Error("Bookings must be made for a future time.")
  }

  return calculateBookingQuote({
    locationId: parsed.locationId,
    resourceId: parsed.resourceId,
    start,
    end,
    durationMinutes: parsed.durationMinutes,
    groupSize: parsed.groupSize,
  })
}

export async function getLocationAvailability(
  context: TenantContext,
  input: unknown,
): Promise<SlotAvailability[]> {
  authorize(context, "booking.read")
  await runBookingExpirySweep()

  const parsed = locationAvailabilityInputSchema.parse(input)
  const day = parseISO(`${parsed.date}T00:00:00`)

  if (Number.isNaN(day.getTime())) {
    throw new Error("Invalid availability date.")
  }

  const activeResources = await listActiveResourcesByLocation(
    context,
    parsed.locationId,
  )

  if (activeResources.length === 0) {
    return []
  }

  const slots = buildDaySlots(day, parsed.durationMinutes)
  const blockingBookings = await findBlockingBookingsForResources(context, {
    resourceIds: activeResources.map((resource) => resource.id),
    start: slots[0]?.startsAt ?? day,
    end: slots.at(-1)?.endsAt ?? day,
  })

  const now = new Date()

  return slots.map((slot) => {
    const slotInPast = slot.startsAt <= now

    const availableResourceIds = slotInPast
      ? []
      : activeResources
          .filter(
            (resource) =>
              !blockingBookings.some(
                (booking) =>
                  booking.resourceId === resource.id &&
                  booking.startTime < slot.endsAt &&
                  booking.endTime > slot.startsAt,
              ),
          )
          .map((resource) => resource.id)

    const isAvailable = availableResourceIds.length > 0
    const quote = calculateBookingQuote({
      locationId: parsed.locationId,
      resourceId: availableResourceIds[0] ?? activeResources[0].id,
      start: slot.startsAt,
      end: slot.endsAt,
      durationMinutes: parsed.durationMinutes,
      groupSize: parsed.groupSize,
    })

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
    }
  })
}

export async function createPendingBooking(
  context: TenantContext,
  input: unknown,
): Promise<CreatePendingBookingResult> {
  authorize(context, "booking.create")
  await runBookingExpirySweep()

  const parsed = createPendingBookingSchema.parse(input)
  const resourceContext = await getResourceContext(context, parsed)

  if (!resourceContext) {
    throw new Error("The selected location or resource is unavailable.")
  }

  const existingUser = await ensureUserExists(parsed.userId)

  if (!existingUser) {
    throw new Error("You must be signed in with a valid account.")
  }

  const { start, end } = buildDateTimeRange(
    parsed.startTimeIso,
    parsed.durationMinutes,
  )

  const roundedStart = roundDateToSlot(start)

  if (roundedStart.toISOString() !== start.toISOString()) {
    throw new Error("Bookings must start on a 30-minute boundary.")
  }

  if (sameBookingDay(start) !== sameBookingDay(end)) {
    throw new Error("Bookings must start and end on the same day.")
  }

  if (start <= new Date()) {
    throw new Error("Bookings must be made for a future time.")
  }

  const blockingBookings = await findBlockingBookings(context, {
    resourceId: parsed.resourceId,
    start,
    end,
  })

  if (blockingBookings.length > 0) {
    throw new Error("That time slot is no longer available.")
  }

  const quote = calculateBookingQuote({
    locationId: parsed.locationId,
    resourceId: parsed.resourceId,
    start,
    end,
    durationMinutes: parsed.durationMinutes,
    groupSize: parsed.groupSize,
  })

  try {
    return await insertPendingBooking(context, {
      booking: {
        ...parsed,
        notes: parsed.notes || `Group size: ${parsed.groupSize}`,
        start,
        end,
        currency: quote.currency,
        subtotalAmount: quote.subtotalAmount.toFixed(2),
        discountAmount: quote.discountAmount.toFixed(2),
        totalAmount: quote.totalAmount.toFixed(2),
        pricingRuleSnapshot: quote.pricingRuleSnapshot,
        expiresAt: getPendingBookingExpiry(),
      },
    })
  } catch (error) {
    if (isBookingOverlapConflict(error)) {
      throw new Error("That time slot is no longer available.")
    }

    throw error
  }
}

export async function listBookingsForUser(input: {
  context: TenantContext
  userId: string
  filter?: BookingListFilter
}): Promise<UserBookingSummary[]> {
  authorize(input.context, "booking.read")
  await runBookingExpirySweep()
  return listUserBookings(input.context, {
    userId: input.userId,
    filter: input.filter,
  })
}

function enrichBookingSummary(booking: UserBookingSummary): UserBookingSummary {
  const eligibility = getEditEligibility({
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    startTime: new Date(booking.startTime),
  })

  return {
    ...booking,
    editable: eligibility.editable,
    editBlockedReason: eligibility.reason,
  }
}

export async function getBookingForUser(input: {
  context: TenantContext
  userId: string
  bookingId: string
}): Promise<UserBookingSummary | null> {
  authorize(input.context, "booking.read")
  await runBookingExpirySweep()
  const booking = await getUserBookingById(input.context, {
    userId: input.userId,
    bookingId: input.bookingId,
  })
  return booking ? enrichBookingSummary(booking) : null
}

export async function listBookingsForUserEnriched(input: {
  context: TenantContext
  userId: string
  filter?: BookingListFilter
}): Promise<UserBookingSummary[]> {
  const bookings = await listBookingsForUser(input)
  return bookings.map(enrichBookingSummary)
}
