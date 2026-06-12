import { NextResponse } from "next/server"

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
  if (error instanceof ReplayServiceError) {
    return replayError({
      code: error.code,
      message: error.message,
      status: error.status,
    })
  }

  if (error instanceof Error) {
    return replayError({
      code: "REPLAY_ERROR",
      message: error.message,
      status: 400,
    })
  }

  return replayError({
    code: "REPLAY_ERROR",
    message: "Something went wrong while processing the replay request.",
    status: 500,
  })
}
