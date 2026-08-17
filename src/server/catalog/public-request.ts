import { type NextRequest } from "next/server"

import { isPublicVenueApiEnabledForTenant } from "@/server/catalog/feature-policy"
import { catalogError } from "@/server/catalog/http"
import { rejectClientTenantId } from "@/server/tenancy/membership-context.mjs"
import { resolvePublicCatalogContext } from "@/server/tenancy/session-context"
import type { TenantContext } from "@/server/tenancy/types"

export async function resolvePublicVenueApiContext(
  req: NextRequest,
): Promise<
  | { enabled: true; context: TenantContext }
  | { enabled: false; response: ReturnType<typeof catalogError> }
> {
  rejectClientTenantId(
    req.headers.get("x-tenant-id") ?? req.nextUrl.searchParams.get("tenantId"),
  )

  const context = await resolvePublicCatalogContext()

  if (!(await isPublicVenueApiEnabledForTenant(context))) {
    return {
      enabled: false,
      response: catalogError({
        code: "NOT_FOUND",
        message: "This resource is not available.",
        status: 404,
      }),
    }
  }

  return { enabled: true, context }
}
