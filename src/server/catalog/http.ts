import { NextResponse } from "next/server"

import { TenancyError } from "@/server/tenancy/errors"

export function catalogJson<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function catalogError(input: {
  code: string
  message: string
  status?: number
}) {
  return NextResponse.json(
    { code: input.code, message: input.message },
    { status: input.status ?? 400 },
  )
}

export function mapCatalogError(error: unknown) {
  if (error instanceof TenancyError) {
    if (
      error.code === "NOT_AUTHENTICATED" ||
      error.code === "MEMBERSHIP_NOT_FOUND" ||
      error.code === "MEMBERSHIP_DISABLED"
    ) {
      return catalogError({
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
      return catalogError({
        code: error.code,
        message: error.message,
        status: 403,
      })
    }
  }

  if (error instanceof Error) {
    return catalogError({
      code: "CATALOG_ERROR",
      message: error.message,
      status: 400,
    })
  }

  return catalogError({
    code: "CATALOG_ERROR",
    message: "Something went wrong while loading the venue catalog.",
    status: 500,
  })
}
