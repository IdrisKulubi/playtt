import { addHours } from "date-fns"

import { BOOKING_EDIT_CUTOFF_HOURS } from "@/server/bookings/constants"
import { BookingModificationError } from "@/server/bookings/modifications/errors"

export type EditableBookingRow = {
  id: string
  userId: string
  status: string
  paymentStatus: string
  startTime: Date
  endTime: Date
  durationMinutes: number
  groupSize: number
  locationId: string
  resourceId: string
  currency: string
  subtotalAmount: string
  discountAmount: string
  totalAmount: string
  notes: string | null
  pricingRuleSnapshot: Record<string, unknown> | null
}

export function getEditEligibility(booking: {
  status: string
  paymentStatus: string
  startTime: Date
}) {
  const now = new Date()

  if (booking.status !== "confirmed" || booking.paymentStatus !== "paid") {
    return {
      editable: false,
      reason: "Only confirmed bookings can be edited.",
    }
  }

  if (booking.startTime <= now) {
    return {
      editable: false,
      reason: "This session has already started.",
    }
  }

  const cutoff = addHours(now, BOOKING_EDIT_CUTOFF_HOURS)

  if (booking.startTime <= cutoff) {
    return {
      editable: false,
      reason: "Changes close 2 hours before your session.",
    }
  }

  return { editable: true, reason: null }
}

export function assertBookingEditable(booking: EditableBookingRow) {
  const eligibility = getEditEligibility(booking)

  if (!eligibility.editable) {
    throw new BookingModificationError(
      "BOOKING_NOT_EDITABLE",
      eligibility.reason ?? "This booking cannot be edited.",
      409,
    )
  }

  return booking
}
