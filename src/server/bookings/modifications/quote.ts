import { calculateBookingQuote } from "@/server/bookings/pricing"
import {
  findBlockingBookingsForResources,
  listActiveResourcesByLocation,
} from "@/server/bookings/repository"
import {
  buildDateTimeRange,
  roundDateToSlot,
} from "@/server/bookings/utils"
import { assertBookingEditable } from "@/server/bookings/modifications/eligibility"
import { BookingModificationError } from "@/server/bookings/modifications/errors"
import {
  getEditableBookingForUser,
  getResourceName,
} from "@/server/bookings/modifications/repository"
import type { ModificationSnapshot } from "@/server/bookings/modifications/types"
import type { modificationQuoteBodySchema } from "@/server/bookings/modifications/validators"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import type { TenantContext } from "@/server/tenancy/types"
import type { z } from "zod/v3"

type ModificationInput = z.infer<typeof modificationQuoteBodySchema>

function toSnapshot(input: {
  startTime: Date
  endTime: Date
  durationMinutes: number
  groupSize: number
  resourceId: string
  subtotalAmount: number
  discountAmount: number
  totalAmount: number
  notes: string | null
  pricingRuleSnapshot: Record<string, unknown>
}): ModificationSnapshot {
  return {
    startTime: input.startTime.toISOString(),
    endTime: input.endTime.toISOString(),
    durationMinutes: input.durationMinutes,
    groupSize: input.groupSize,
    resourceId: input.resourceId,
    subtotalAmount: input.subtotalAmount.toFixed(2),
    discountAmount: input.discountAmount.toFixed(2),
    totalAmount: input.totalAmount.toFixed(2),
    notes: input.notes,
    pricingRuleSnapshot: input.pricingRuleSnapshot,
  }
}

function resolveChangeType(
  input: ModificationInput,
  timeChanged: boolean,
  groupChanged: boolean
) {
  if (timeChanged && groupChanged) {
    return "combined"
  }

  if (timeChanged) {
    return "time"
  }

  if (groupChanged) {
    return "group_size"
  }

  return "notes"
}

export async function quoteBookingModification(input: {
  context: TenantContext
  bookingId: string
  userId: string
  body: ModificationInput
}) {
  authorize(input.context, "booking.modify")
  const booking = await getEditableBookingForUser(input.context, {
    bookingId: input.bookingId,
    userId: input.userId,
  })

  if (!booking) {
    throw new BookingModificationError(
      "BOOKING_NOT_FOUND",
      "We could not find that booking.",
      404
    )
  }

  assertBookingEditable(booking)

  const nextGroupSize = input.body.groupSize ?? booking.groupSize

  let nextStart = booking.startTime
  let nextEnd = booking.endTime
  let nextResourceId = booking.resourceId
  const timeChanged = Boolean(input.body.startTimeIso)

  if (input.body.startTimeIso) {
    const { start, end } = buildDateTimeRange(
      input.body.startTimeIso,
      booking.durationMinutes
    )

    const roundedStart = roundDateToSlot(start)

    if (roundedStart.toISOString() !== start.toISOString()) {
      throw new BookingModificationError(
        "INVALID_SLOT",
        "Bookings must start on a 30-minute boundary.",
        400
      )
    }

    if (start <= new Date()) {
      throw new BookingModificationError(
        "BOOKING_IN_PAST",
        "Bookings must be made for a future time.",
        400
      )
    }

    const activeResources = await listActiveResourcesByLocation(
      input.context,
      booking.locationId,
    )

    if (activeResources.length === 0) {
      throw new BookingModificationError(
        "SLOT_UNAVAILABLE",
        "That time slot is no longer available.",
        409
      )
    }

    const blocking = await findBlockingBookingsForResources(input.context, {
      resourceIds: activeResources.map((resource) => resource.id),
      start,
      end,
      excludeBookingId: booking.id,
    })

    const availableResourceIds = activeResources
      .filter(
        (resource) =>
          !blocking.some(
            (blocked) =>
              blocked.resourceId === resource.id &&
              blocked.startTime < end &&
              blocked.endTime > start
          )
      )
      .map((resource) => resource.id)

    if (availableResourceIds.length === 0) {
      throw new BookingModificationError(
        "SLOT_UNAVAILABLE",
        "That time slot is no longer available.",
        409
      )
    }

    const preferredResourceId = availableResourceIds.includes(
      booking.resourceId
    )
      ? booking.resourceId
      : availableResourceIds[0]

    nextStart = start
    nextEnd = end
    nextResourceId = preferredResourceId
  }

  const groupChanged = nextGroupSize !== booking.groupSize
  const notesChanged =
    input.body.notes !== undefined && input.body.notes !== (booking.notes ?? "")

  if (!timeChanged && !groupChanged && !notesChanged) {
    throw new BookingModificationError("NO_CHANGE", "Nothing to update.", 400)
  }

  const quote = calculateBookingQuote({
    locationId: booking.locationId,
    resourceId: nextResourceId,
    start: nextStart,
    end: nextEnd,
    durationMinutes: booking.durationMinutes,
    groupSize: nextGroupSize,
  })

  const currentTotal = Number(booking.totalAmount)
  const newTotal = quote.totalAmount
  const deltaAmount = newTotal - currentTotal
  const creditAmount = Math.max(0, currentTotal - newTotal)

  const nextNotes =
    input.body.notes !== undefined
      ? input.body.notes || `Group size: ${nextGroupSize}`
      : groupChanged
        ? `Group size: ${nextGroupSize}`
        : booking.notes

  const afterSnapshot = toSnapshot({
    startTime: nextStart,
    endTime: nextEnd,
    durationMinutes: booking.durationMinutes,
    groupSize: nextGroupSize,
    resourceId: nextResourceId,
    subtotalAmount: quote.subtotalAmount,
    discountAmount: quote.discountAmount,
    totalAmount: newTotal,
    notes: nextNotes,
    pricingRuleSnapshot: quote.pricingRuleSnapshot,
  })

  const beforeSnapshot = toSnapshot({
    startTime: booking.startTime,
    endTime: booking.endTime,
    durationMinutes: booking.durationMinutes,
    groupSize: booking.groupSize,
    resourceId: booking.resourceId,
    subtotalAmount: Number(booking.subtotalAmount),
    discountAmount: Number(booking.discountAmount),
    totalAmount: currentTotal,
    notes: booking.notes,
    pricingRuleSnapshot: booking.pricingRuleSnapshot ?? {},
  })

  return {
    beforeSnapshot,
    afterSnapshot,
    quote: {
      currentTotal: currentTotal.toFixed(2),
      newTotal: newTotal.toFixed(2),
      deltaAmount: deltaAmount.toFixed(2),
      requiresPayment: deltaAmount > 0,
      creditAmount: creditAmount.toFixed(2),
      changeType: resolveChangeType(input.body, timeChanged, groupChanged),
      newGroupSize: nextGroupSize,
      newStartTime: nextStart.toISOString(),
      newEndTime: nextEnd.toISOString(),
      newResourceId: nextResourceId,
      newResourceName: await getResourceName(input.context, nextResourceId),
      currency: booking.currency,
    },
  }
}
