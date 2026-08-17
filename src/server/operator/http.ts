import { NextResponse } from "next/server"
import { ZodError } from "zod/v3"

import { TenancyError } from "@/server/tenancy/errors"

export function operatorJson<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function operatorError(input: {
  code: string
  message: string
  status?: number
}) {
  return NextResponse.json(
    { code: input.code, message: input.message },
    { status: input.status ?? 400 },
  )
}

export function mapOperatorError(error: unknown) {
  if (error instanceof TenancyError) {
    if (
      error.code === "NOT_AUTHENTICATED" ||
      error.code === "MEMBERSHIP_NOT_FOUND" ||
      error.code === "MEMBERSHIP_DISABLED"
    ) {
      return operatorError({
        code: error.code,
        message: error.message,
        status: 401,
      })
    }

    if (
      error.code === "FORBIDDEN_ACTION" ||
      error.code === "FORBIDDEN_TENANT" ||
      error.code === "DEVICE_CONTEXT_UNSUPPORTED"
    ) {
      return operatorError({
        code: error.code,
        message: error.message,
        status: 403,
      })
    }
  }

  if (error instanceof ZodError) {
    return operatorError({
      code: "VALIDATION_ERROR",
      message: error.issues[0]?.message ?? "Invalid operator request.",
      status: 400,
    })
  }

  if (error instanceof Error) {
    return operatorError({
      code: "OPERATOR_ERROR",
      message: error.message,
      status: 400,
    })
  }

  return operatorError({
    code: "OPERATOR_ERROR",
    message: "Something went wrong while processing the operator request.",
    status: 500,
  })
}
