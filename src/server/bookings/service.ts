import { addMinutes } from "date-fns"

import { DEFAULT_VENUE_TIMEZONE } from "@/server/bookings/constants"
import {
  buildDateTimeRange,
  buildDaySlots,
  getPendingBookingExpiry,
  isSlotClosedForBooking,
  sameBookingDay,
  zonedWallTime,
} from "@/server/bookings/utils"
import {
  earliestBookableStart,
  freeResourceIds,
  isOnStartStep,
  planBooking,
  type PlanSuggestion,
} from "@/server/bookings/scheduling.mjs"
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
  BookingPlan,
  BookingQuote,
  BookingSuggestion,
  CreatePendingBookingResult,
  LocationSummary,
  SlotAvailability,
  SlotPrice,
  UserBookingSummary,
} from "@/server/bookings/types"
import { getEditEligibility } from "@/server/bookings/modifications/eligibility"
import {
  bookingPlanInputSchema,
  bookingQuoteInputSchema,
  createPendingBookingSchema,
  locationAvailabilityInputSchema,
} from "@/server/bookings/validators"
import { isBookingOverlapConflict } from "@/server/bookings/database-errors"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import type { TenantContext } from "@/server/tenancy/types"

const START_STEP_MESSAGE = "Pick a start time on a 5-minute step, like 11:50."

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

  if (!isOnStartStep(start)) {
    throw new Error(START_STEP_MESSAGE)
  }

  if (isSlotClosedForBooking(start)) {
    throw new Error("Bookings must be made for a future time.")
  }

  return calculateBookingQuote({
    locationId: parsed.locationId,
    resourceId: parsed.resourceId,
    start,
    end,
    durationMinutes: parsed.durationMinutes,
    groupSize: parsed.groupSize,
    timeZone: resourceContext.timezone ?? DEFAULT_VENUE_TIMEZONE,
  })
}

export async function getLocationAvailability(
  context: TenantContext,
  input: unknown,
): Promise<SlotAvailability[]> {
  authorize(context, "booking.read")
  await runBookingExpirySweep()

  const parsed = locationAvailabilityInputSchema.parse(input)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
    throw new Error("Invalid availability date.")
  }

  const activeResources = await listActiveResourcesByLocation(
    context,
    parsed.locationId,
  )

  if (activeResources.length === 0) {
    return []
  }

  const timeZone = activeResources[0]?.timezone ?? DEFAULT_VENUE_TIMEZONE
  const now = new Date()
  const slots = withEarliestStart(
    buildDaySlots(parsed.date, parsed.durationMinutes, timeZone),
    parsed.date,
    parsed.durationMinutes,
    timeZone,
    now,
  )
  const firstSlot = slots[0]
  const lastSlot = slots.at(-1)

  if (!firstSlot || !lastSlot) {
    return []
  }

  const resourceIds = activeResources.map((resource) => resource.id)
  const blockingBookings = await findBlockingBookingsForResources(context, {
    resourceIds,
    start: firstSlot.startsAt,
    end: lastSlot.endsAt,
  })

  return slots.map((slot) => {
    const slotInPast = isSlotClosedForBooking(slot.startsAt, now)

    const availableResourceIds = slotInPast
      ? []
      : freeResourceIds({
          resourceIds,
          bookings: blockingBookings,
          start: slot.startsAt,
          end: slot.endsAt,
        })

    return {
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      durationMinutes: parsed.durationMinutes,
      isAvailable: availableResourceIds.length > 0,
      openTableCount: availableResourceIds.length,
      availableResourceIds,
      ...(slot.isEarliest ? { isEarliest: true } : {}),
      price: priceFor({
        locationId: parsed.locationId,
        resourceId: availableResourceIds[0] ?? resourceIds[0],
        start: slot.startsAt,
        durationMinutes: parsed.durationMinutes,
        groupSize: parsed.groupSize,
        timeZone,
      }),
    }
  })
}

/**
 * For today, adds the soonest start (next 5-minute step) ahead of the next
 * half-hour mark, so at 11:47 people can book 11:50 rather than wait for 12:00.
 */
function withEarliestStart(
  slots: { startsAt: Date; endsAt: Date }[],
  dateKey: string,
  durationMinutes: number,
  timeZone: string,
  now: Date,
): { startsAt: Date; endsAt: Date; isEarliest?: boolean }[] {
  const earliest = earliestBookableStart(now)

  if (sameBookingDay(earliest, timeZone) !== dateKey) {
    return slots
  }

  const earliestMs = earliest.getTime()

  if (slots.some((slot) => slot.startsAt.getTime() === earliestMs)) {
    return slots.map((slot) =>
      slot.startsAt.getTime() === earliestMs
        ? { ...slot, isEarliest: true }
        : slot,
    )
  }

  return [
    ...slots,
    {
      startsAt: earliest,
      endsAt: addMinutes(earliest, durationMinutes),
      isEarliest: true,
    },
  ].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
}

function priceFor(input: {
  locationId: string
  resourceId: string
  start: Date
  durationMinutes: number
  groupSize: number
  timeZone: string
}): SlotPrice {
  const quote = calculateBookingQuote({
    ...input,
    end: addMinutes(input.start, input.durationMinutes),
  })

  return {
    currency: quote.currency,
    subtotalAmount: quote.subtotalAmount,
    discountAmount: quote.discountAmount,
    totalAmount: quote.totalAmount,
    pricingRuleSnapshot: quote.pricingRuleSnapshot,
  }
}

/**
 * Checks a custom time (any 5-minute step) against every table at the venue.
 * Free: returns the table and price. Clashing or already past: returns when the
 * tables are busy and up to three of the closest times that do work.
 */
export async function planBookingTime(
  context: TenantContext,
  input: unknown,
): Promise<BookingPlan> {
  authorize(context, "booking.read")
  await runBookingExpirySweep()

  const parsed = bookingPlanInputSchema.parse(input)
  const { start, end } = buildDateTimeRange(
    parsed.startTimeIso,
    parsed.durationMinutes,
  )

  if (!isOnStartStep(start)) {
    throw new Error(START_STEP_MESSAGE)
  }

  const activeResources = await listActiveResourcesByLocation(
    context,
    parsed.locationId,
  )

  if (activeResources.length === 0) {
    throw new Error("The selected location or resource is unavailable.")
  }

  const timeZone = activeResources[0]?.timezone ?? DEFAULT_VENUE_TIMEZONE
  const resourceIds = activeResources.map((resource) => resource.id)
  const now = new Date()
  const earliest = earliestBookableStart(now)
  const isPast = isSlotClosedForBooking(start, now)
  // A past start is checked as "the soonest start" so we can offer that.
  const effectiveStart = isPast ? earliest : start

  // Search the whole booking day of the requested start (games may run past
  // midnight, like the 11:30 PM slot in the list).
  const dateKey = sameBookingDay(effectiveStart, timeZone)
  const dayStart = zonedWallTime(dateKey, 0, 0, timeZone)
  const dayEnd = addMinutes(dayStart, 24 * 60)

  const bookings = await findBlockingBookingsForResources(context, {
    resourceIds,
    start: dayStart,
    end: addMinutes(dayEnd, 3 * 60),
  })

  const result = planBooking({
    resourceIds,
    bookings,
    start: effectiveStart,
    durationMinutes: parsed.durationMinutes,
    now,
    searchStart: dayStart,
    searchEnd: dayEnd,
  })

  const price = (resourceId: string, at: Date, minutes: number) =>
    priceFor({
      locationId: parsed.locationId,
      resourceId,
      start: at,
      durationMinutes: minutes,
      groupSize: parsed.groupSize,
      timeZone,
    })

  const toSuggestion = (suggestion: PlanSuggestion): BookingSuggestion => ({
    kind: suggestion.kind,
    startsAt: suggestion.startsAt.toISOString(),
    endsAt: suggestion.endsAt.toISOString(),
    durationMinutes: suggestion.durationMinutes,
    // Always measured from what the person asked for.
    shiftMinutes: Math.round(
      (suggestion.startsAt.getTime() - start.getTime()) / 60_000,
    ),
    resourceId: suggestion.resourceId,
    price: price(
      suggestion.resourceId,
      suggestion.startsAt,
      suggestion.durationMinutes,
    ),
  })

  const base = {
    requested: {
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      durationMinutes: parsed.durationMinutes,
    },
    earliestStartIso: earliest.toISOString(),
  }

  if (isPast) {
    const suggestions =
      result.status === "available"
        ? [
            toSuggestion({
              kind: "later",
              resourceId: result.resourceId,
              startsAt: earliest,
              endsAt: addMinutes(earliest, parsed.durationMinutes),
              durationMinutes: parsed.durationMinutes,
              shiftMinutes: 0,
            }),
          ]
        : result.suggestions.map(toSuggestion)

    return {
      ...base,
      status: "past",
      resourceId: null,
      price: null,
      conflicts: [],
      suggestions,
    }
  }

  if (result.status === "available") {
    return {
      ...base,
      status: "available",
      resourceId: result.resourceId,
      price: price(result.resourceId, start, parsed.durationMinutes),
      conflicts: [],
      suggestions: [],
    }
  }

  return {
    ...base,
    status: "conflict",
    resourceId: null,
    price: null,
    conflicts: mergeBusyTimes(result.conflicts),
    suggestions: result.suggestions.map(toSuggestion),
  }
}

/** Busy times merged across tables. Never says who booked them. */
function mergeBusyTimes(
  conflicts: { startsAt: Date; endsAt: Date }[],
): { startsAt: string; endsAt: string }[] {
  const merged: { startsAt: Date; endsAt: Date }[] = []

  for (const conflict of [...conflicts].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  )) {
    const last = merged.at(-1)
    if (last && conflict.startsAt.getTime() <= last.endsAt.getTime()) {
      if (conflict.endsAt > last.endsAt) last.endsAt = conflict.endsAt
      continue
    }
    merged.push({ ...conflict })
  }

  return merged.map((item) => ({
    startsAt: item.startsAt.toISOString(),
    endsAt: item.endsAt.toISOString(),
  }))
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

  if (!isOnStartStep(start)) {
    throw new Error(START_STEP_MESSAGE)
  }

  if (isSlotClosedForBooking(start)) {
    throw new Error("Bookings must be made for a future time.")
  }

  // If someone just took the chosen table, move to another free table at the
  // same venue for the same time before giving up.
  let resourceId = parsed.resourceId
  const blockingBookings = await findBlockingBookings(context, {
    resourceId,
    start,
    end,
  })

  if (blockingBookings.length > 0) {
    const venueResources = await listActiveResourcesByLocation(
      context,
      parsed.locationId,
    )
    const otherIds = venueResources
      .map((resource) => resource.id)
      .filter((id) => id !== parsed.resourceId)
    const otherBookings = await findBlockingBookingsForResources(context, {
      resourceIds: otherIds,
      start,
      end,
    })
    const [freeId] = freeResourceIds({
      resourceIds: otherIds,
      bookings: otherBookings,
      start,
      end,
    })

    if (!freeId) {
      throw new Error("That time slot is no longer available.")
    }

    resourceId = freeId
  }

  const quote = calculateBookingQuote({
    locationId: parsed.locationId,
    resourceId,
    start,
    end,
    durationMinutes: parsed.durationMinutes,
    groupSize: parsed.groupSize,
    timeZone: resourceContext.timezone ?? DEFAULT_VENUE_TIMEZONE,
  })

  try {
    return await insertPendingBooking(context, {
      booking: {
        ...parsed,
        resourceId,
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
