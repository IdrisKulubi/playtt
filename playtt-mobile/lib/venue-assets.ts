import type { ImageSource } from "expo-image"

import type { LocationSummary } from "@/lib/booking-types"
import type { UserBookingSummary } from "@/lib/booking-types"

const VENUE_IMAGES: Record<string, ImageSource> = {
  "playtt-hurlingham": require("@/assets/images/playtt-hurlingham-venue.png"),
}

const DEFAULT_VENUE_IMAGE = VENUE_IMAGES["playtt-hurlingham"]

export function getVenueImage(location?: Pick<LocationSummary, "slug"> | null) {
  if (!location?.slug) {
    return DEFAULT_VENUE_IMAGE
  }

  return VENUE_IMAGES[location.slug] ?? DEFAULT_VENUE_IMAGE
}

export const PRIMARY_VENUE = {
  name: "PlayTT Hurlingham",
  slug: "playtt-hurlingham",
  address: "Hurlingham, Nairobi, Kenya",
} as const

export function locationFromBooking(
  booking: Pick<UserBookingSummary, "locationName">,
): Pick<LocationSummary, "name" | "slug" | "address"> {
  const normalizedName = booking.locationName.trim().toLowerCase()

  if (normalizedName.includes("hurlingham")) {
    return PRIMARY_VENUE
  }

  return {
    name: booking.locationName,
    slug: "playtt-hurlingham",
    address: PRIMARY_VENUE.address,
  }
}
