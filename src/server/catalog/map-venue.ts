import { mapLocationToVenue as mapLocationToVenueCore } from "./map-venue.mjs"
import type { LocationRow, Venue } from "./types"

export function mapLocationToVenue(location: LocationRow): Venue {
  return mapLocationToVenueCore(location) as Venue
}
