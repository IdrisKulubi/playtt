import { NextResponse } from "next/server"
import { ZodError } from "zod/v3"

import { PaymentServiceError } from "@/server/payments/errors"

export function paymentJson<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function paymentError(input: {
  code: string
  message: string
  status?: number
}) {
  return NextResponse.json(
    { code: input.code, message: input.message },
    { status: input.status ?? 400 },
  )
}

export function mapPaymentServiceError(error: unknown) {
  if (error instanceof PaymentServiceError) {
    return paymentError({
      code: error.code,
      message: error.message,
      status: error.status,
    })
  }

  if (error instanceof ZodError) {
    return paymentError({
      code: "VALIDATION_ERROR",
      message: error.issues[0]?.message ?? "Invalid payment request.",
      status: 400,
    })
  }

  return paymentError({
    code: "PAYMENT_ERROR",
    message: "Something went wrong while processing the payment.",
    status: 500,
  })
}
