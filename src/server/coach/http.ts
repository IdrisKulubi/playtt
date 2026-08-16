import { NextResponse } from "next/server"

import { CoachServiceError } from "@/server/coach/errors"
import { mapDomainOrUnexpectedError } from "@/server/http/error-mapping"

export function coachJson<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function coachError(input: {
  code: string
  message: string
  status?: number
}) {
  return NextResponse.json(
    { code: input.code, message: input.message },
    { status: input.status ?? 400 },
  )
}

export function mapCoachServiceError(error: unknown) {
  return coachError(
    mapDomainOrUnexpectedError(
      error,
      (input): input is CoachServiceError => input instanceof CoachServiceError,
      {
        code: "COACH_ERROR",
        message: "Something went wrong while processing the coach request.",
      },
    ),
  )
}
