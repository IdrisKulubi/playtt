import { NextResponse } from "next/server"

import { mapDomainOrUnexpectedError } from "@/server/http/error-mapping"

const isNeverDomainError = (_error: unknown): _error is never => false

export function userError(input: {
  code: string
  message: string
  status?: number
}) {
  return NextResponse.json(
    { code: input.code, message: input.message },
    { status: input.status ?? 400 },
  )
}

export function mapUserRouteError(error: unknown) {
  return userError(
    mapDomainOrUnexpectedError(error, isNeverDomainError, {
      code: "USER_ERROR",
      message: "Something went wrong while processing the user request.",
    }),
  )
}
