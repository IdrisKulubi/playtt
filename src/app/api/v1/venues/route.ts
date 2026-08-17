import { type NextRequest } from "next/server"

import { catalogJson, mapCatalogError } from "@/server/catalog/http"
import { resolvePublicVenueApiContext } from "@/server/catalog/public-request"
import { listVenuesForPublicApi } from "@/server/catalog/service"

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolvePublicVenueApiContext(req)

    if (!resolved.enabled) {
      return resolved.response
    }

    const venues = await listVenuesForPublicApi(resolved.context)
    return catalogJson({ venues })
  } catch (error) {
    return mapCatalogError(error)
  }
}
