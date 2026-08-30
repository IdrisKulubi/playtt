import { NextResponse } from "next/server"
import { ZodError } from "zod/v3"

import { DeviceError } from "@/server/devices/errors"

export function deviceJson<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function deviceError(input: {
  code: string
  message: string
  status?: number
}) {
  return NextResponse.json(
    { code: input.code, message: input.message },
    { status: input.status ?? 400 },
  )
}

export function mapDeviceError(error: unknown) {
  if (error instanceof DeviceError) {
    return deviceError({
      code: error.code,
      message: error.message,
      status: error.status,
    })
  }

  if (error instanceof ZodError) {
    const issue = error.issues[0]
    const path = issue?.path?.length ? `${issue.path.join(".")}: ` : ""
    return deviceError({
      code: "VALIDATION_ERROR",
      message: `${path}${issue?.message ?? "Invalid device request."}`,
      status: 400,
    })
  }

  if (error instanceof Error) {
    return deviceError({
      code: "DEVICE_ERROR",
      message: error.message,
      status: 400,
    })
  }

  return deviceError({
    code: "DEVICE_ERROR",
    message: "Unexpected device error.",
    status: 500,
  })
}
