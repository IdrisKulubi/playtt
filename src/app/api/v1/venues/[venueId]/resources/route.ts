import { type NextRequest } from "next/server"

import {
  catalogError,
  catalogJson,
  mapCatalogError,
} from "@/server/catalog/http"
import { resolvePublicVenueApiContext } from "@/server/catalog/public-request"
import { listVenueResourcesForPublicApi } from "@/server/catalog/service"

type RouteContext = {
  params: Promise<{ venueId: string }>
}

export async function GET(req: NextRequest, routeContext: RouteContext) {
  try {
    const resolved = await resolvePublicVenueApiContext(req)

    if (!resolved.enabled) {
      return resolved.response
    }

    const { venueId } = await routeContext.params
    const result = await listVenueResourcesForPublicApi(resolved.context, venueId)

    if (!result) {
      return catalogError({
        code: "VENUE_NOT_FOUND",
        message: "We could not find that venue.",
        status: 404,
      })
    }

    return catalogJson({
      venueId: result.venue.venueId,
      resources: result.resources,
    })
  } catch (error) {
    return mapCatalogError(error)
  }
}
