import { NextResponse } from "next/server"
import { ZodError } from "zod/v3"

import { BookingModificationError } from "@/server/bookings/modifications/errors"

export function bookingJson<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function bookingError(
  input: { code: string; message: string; status?: number },
) {
  return NextResponse.json(
    { code: input.code, message: input.message },
    { status: input.status ?? 400 },
  )
}

export function mapBookingServiceError(error: unknown) {
  if (error instanceof BookingModificationError) {
    return bookingError({
      code: error.code,
      message: error.message,
      status: error.status,
    })
  }

  if (error instanceof ZodError) {
    return bookingError({
      code: "VALIDATION_ERROR",
      message: error.issues[0]?.message ?? "Invalid booking request.",
      status: 400,
    })
  }

  if (error instanceof Error) {
    const message = error.message

    if (message.includes("no longer available")) {
      return bookingError({
        code: "SLOT_UNAVAILABLE",
        message,
        status: 409,
      })
    }

    if (message.includes("signed in") || message.includes("valid account")) {
      return bookingError({
        code: "UNAUTHENTICATED",
        message,
        status: 401,
      })
    }

    return bookingError({
      code: "BOOKING_ERROR",
      message,
      status: 400,
    })
  }

  return bookingError({
    code: "BOOKING_ERROR",
    message: "Something went wrong while processing the booking.",
    status: 500,
  })
}
