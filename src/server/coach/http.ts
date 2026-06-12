import { NextResponse } from "next/server"

import { CoachServiceError } from "@/server/coach/errors"

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
  if (error instanceof CoachServiceError) {
    return coachError({
      code: error.code,
      message: error.message,
      status: error.status,
    })
  }

  if (error instanceof Error) {
    return coachError({
      code: "COACH_ERROR",
      message: error.message,
      status: 400,
    })
  }

  return coachError({
    code: "COACH_ERROR",
    message: "Something went wrong while processing the coach request.",
    status: 500,
  })
}
