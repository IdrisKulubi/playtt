import { NextResponse } from "next/server"
import { ZodError } from "zod/v3"

import { mapDomainOrUnexpectedError } from "@/server/http/error-mapping"
import { MediaServiceError } from "@/server/media/errors"

export function mediaJson<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function mediaError(input: {
  code: string
  message: string
  status?: number
}) {
  return NextResponse.json(
    { code: input.code, message: input.message },
    { status: input.status ?? 400 },
  )
}

export function mapMediaServiceError(error: unknown) {
  if (error instanceof ZodError) {
    return mediaError({
      code: "VALIDATION_ERROR",
      message: error.issues[0]?.message ?? "Invalid media request.",
      status: 400,
    })
  }

  return mediaError(
    mapDomainOrUnexpectedError(
      error,
      (input): input is MediaServiceError => input instanceof MediaServiceError,
      {
        code: "MEDIA_ERROR",
        message: "Something went wrong while processing the media request.",
      },
    ),
  )
}
