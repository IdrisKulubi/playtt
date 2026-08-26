import { type NextRequest, NextResponse } from "next/server"

import { accessAdminNoStoreHeaders } from "@/server/access/admin-contract"
import { resolveAccessAdminContext } from "@/server/access/admin-api-context"
import { listAccessOperations } from "@/server/access/admin-service"
import { mapOperatorError } from "@/server/operator/http"

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveAccessAdminContext(req)
    if ("error" in resolved) return resolved.error

    const locationId = req.nextUrl.searchParams.get("locationId") ?? undefined
    const operations = await listAccessOperations(resolved.context, { locationId })
    return NextResponse.json(
      { data: { operations } },
      { headers: accessAdminNoStoreHeaders },
    )
  } catch (error) {
    return mapOperatorError(error)
  }
}
