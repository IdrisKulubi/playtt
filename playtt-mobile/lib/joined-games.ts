import type { CommunitySharedBooking } from "@/lib/community-types"

/** Upcoming or live games I joined as a guest through Players. */
export function joinedGames(bookings: CommunitySharedBooking[]) {
  return bookings
    .filter((booking) => booking.role === "guest" && booking.phase !== "ended")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}
