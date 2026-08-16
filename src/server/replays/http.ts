import { NextResponse } from "next/server"
import { ZodError } from "zod/v3"

import { mapDomainOrUnexpectedError } from "@/server/http/error-mapping"
import { ReplayServiceError } from "@/server/replays/errors"

export function replayJson<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function replayError(input: {
  code: string
  message: string
  status?: number
}) {
  return NextResponse.json(
    { code: input.code, message: input.message },
    { status: input.status ?? 400 },
  )
}

export function mapReplayServiceError(error: unknown) {
  if (error instanceof ZodError) {
    return replayError({
      code: "VALIDATION_ERROR",
      message: error.issues[0]?.message ?? "Invalid replay request.",
      status: 400,
    })
  }

  return replayError(
    mapDomainOrUnexpectedError(
      error,
      (input): input is ReplayServiceError => input instanceof ReplayServiceError,
      {
        code: "REPLAY_ERROR",
        message: "Something went wrong while processing the replay request.",
      },
    ),
  )
}
