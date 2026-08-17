import {
  getPublicVenueById,
  getPublicVenueDetail,
  listPublicResourcesForVenue,
  listPublicVenues,
} from "@/server/catalog/repository"
import type {
  PublicResource,
  PublicVenue,
  PublicVenueDetail,
} from "@/server/catalog/types"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import type { TenantContext } from "@/server/tenancy/types"

export async function listVenuesForPublicApi(
  context: TenantContext,
): Promise<PublicVenue[]> {
  authorize(context, "venue.read")
  return listPublicVenues(context)
}

export async function getVenueForPublicApi(
  context: TenantContext,
  venueId: string,
): Promise<PublicVenueDetail | null> {
  authorize(context, "venue.read")
  return getPublicVenueDetail(context, venueId)
}

export async function listVenueResourcesForPublicApi(
  context: TenantContext,
  venueId: string,
): Promise<{ venue: PublicVenue; resources: PublicResource[] } | null> {
  authorize(context, "venue.read")

  const venue = await getPublicVenueById(context, venueId)

  if (!venue) {
    return null
  }

  const resources = await listPublicResourcesForVenue(context, venueId)
  return { venue, resources }
}
