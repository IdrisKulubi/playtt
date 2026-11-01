import { apiFetch } from "@/lib/api-client"
import type {
  CommunityAtVenue,
  CommunityBookingMatch,
  CommunityEvent,
  CommunityGroup,
  CommunityHeadToHead,
  CommunityInvite,
  CommunityMe,
  CommunityPlayer,
  CommunitySharedBooking,
  KudosType,
  CommunityPlayerDetail,
  CommunityPlayerPage,
  CommunityPlayersFilters,
  CommunityProfilePatch,
  CommunityReportReason,
  CommunityVenueRef,
  GoOpenInput,
} from "@/lib/community-types"

type Envelope<T> = { data: T }

const BASE = "/api/v1/community"

function playerPath(userId: string, suffix = "") {
  return `${BASE}/players/${encodeURIComponent(userId)}${suffix}`
}

function withQuery(path: string, params: Record<string, string | boolean | undefined>) {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== false) {
      search.set(key, String(value))
    }
  }

  const query = search.toString()
  return query ? `${path}?${query}` : path
}

export async function fetchCommunityMe() {
  const response = await apiFetch<Envelope<{ me: CommunityMe }>>(`${BASE}/me`)
  return response.data.me
}

export async function updateCommunityProfile(patch: CommunityProfilePatch) {
  const response = await apiFetch<Envelope<{ me: CommunityMe }>>(`${BASE}/me`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
  return response.data.me
}

export async function goOpenToPlay(input: GoOpenInput) {
  const response = await apiFetch<Envelope<{ me: CommunityMe }>>(`${BASE}/availability`, {
    method: "POST",
    body: JSON.stringify(input),
  })
  return response.data.me
}

export async function stopOpenToPlay() {
  const response = await apiFetch<Envelope<{ me: CommunityMe }>>(`${BASE}/availability`, {
    method: "DELETE",
  })
  return response.data.me
}

export async function fetchCommunityPlayers(filters: CommunityPlayersFilters = {}) {
  const response = await apiFetch<
    Envelope<CommunityPlayerPage & { venue: CommunityVenueRef }>
  >(withQuery(`${BASE}/players`, filters))
  return response.data
}

export async function fetchCommunityPlayer(userId: string) {
  const response = await apiFetch<Envelope<{ player: CommunityPlayerDetail }>>(playerPath(userId))
  return response.data.player
}

export async function followPlayer(userId: string) {
  const response = await apiFetch<Envelope<{ player: CommunityPlayerDetail }>>(
    playerPath(userId, "/follow"),
    { method: "POST" },
  )
  return response.data.player
}

export async function unfollowPlayer(userId: string) {
  await apiFetch(playerPath(userId, "/follow"), { method: "DELETE" })
}

export async function fetchPlayerConnections(
  userId: string,
  kind: "followers" | "following",
  cursor?: string,
) {
  const response = await apiFetch<Envelope<CommunityPlayerPage>>(
    withQuery(playerPath(userId, `/${kind}`), { cursor }),
  )
  return response.data
}

export async function blockPlayer(userId: string) {
  await apiFetch(playerPath(userId, "/block"), { method: "POST" })
}

export async function unblockPlayer(userId: string) {
  await apiFetch(playerPath(userId, "/block"), { method: "DELETE" })
}

export async function reportPlayer(input: {
  targetUserId: string
  reason: CommunityReportReason
  note?: string
  messageId?: string
}) {
  await apiFetch(`${BASE}/reports`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

// --- Social loop (M4) ---

export async function fetchAtVenue() {
  const response = await apiFetch<Envelope<CommunityAtVenue>>(`${BASE}/at-venue`)
  return response.data
}

export async function fetchRallyPartners() {
  const response = await apiFetch<Envelope<{ players: CommunityPlayer[] }>>(`${BASE}/rally-partners`)
  return response.data.players
}

type SharedBookingsEnvelope = Envelope<{ bookings: CommunitySharedBooking[] }>

export async function fetchSharedBookings() {
  const response = await apiFetch<SharedBookingsEnvelope>(`${BASE}/bookings`)
  return response.data.bookings
}

function bookingPath(bookingId: string, suffix: string) {
  return `${BASE}/bookings/${encodeURIComponent(bookingId)}${suffix}`
}

/** Join a host's booking from the booking card they shared in a chat. */
export async function joinSharedBooking(bookingId: string, conversationId: string) {
  const response = await apiFetch<SharedBookingsEnvelope>(bookingPath(bookingId, "/join"), {
    method: "POST",
    body: JSON.stringify({ conversationId }),
  })
  return response.data.bookings
}

export async function leaveSharedBooking(bookingId: string) {
  const response = await apiFetch<SharedBookingsEnvelope>(bookingPath(bookingId, "/join"), { method: "DELETE" })
  return response.data.bookings
}

export async function giveKudos(bookingId: string, receiverId: string, types: KudosType[]) {
  const response = await apiFetch<SharedBookingsEnvelope>(bookingPath(bookingId, "/kudos"), {
    method: "POST",
    body: JSON.stringify({ receiverId, types }),
  })
  return response.data.bookings
}

// --- Groups, scoreboard, invites (M5) ---

export async function fetchHeadToHead(userId: string) {
  const response = await apiFetch<Envelope<{ headToHead: CommunityHeadToHead }>>(playerPath(userId, "/head-to-head"))
  return response.data.headToHead
}

/** Record who played which side of a shared booking's scoreboard match (host only). */
export async function assignMatchSides(bookingId: string, sideA: string, sideB: string) {
  const response = await apiFetch<Envelope<{ match: CommunityBookingMatch | null }>>(bookingPath(bookingId, "/sides"), {
    method: "POST",
    body: JSON.stringify({ sideA, sideB }),
  })
  return response.data.match
}

export async function joinDoubles(hostId: string) {
  const response = await apiFetch<Envelope<{ group: CommunityGroup }>>(playerPath(hostId, "/doubles"), {
    method: "POST",
  })
  return response.data.group
}

export async function fetchEvents() {
  const response = await apiFetch<Envelope<{ events: CommunityEvent[] }>>(`${BASE}/events`)
  return response.data.events
}

export async function joinEvent(eventId: string) {
  const response = await apiFetch<Envelope<{ group: CommunityGroup }>>(
    `${BASE}/events/${encodeURIComponent(eventId)}/join`,
    { method: "POST" },
  )
  return response.data.group
}

export async function createInvite() {
  const response = await apiFetch<Envelope<{ invite: CommunityInvite }>>(`${BASE}/invites`, { method: "POST" })
  return response.data.invite
}

export async function acceptInvite(code: string) {
  const response = await apiFetch<Envelope<{ conversationId: string; inviterId: string }>>(
    `${BASE}/invites/${encodeURIComponent(code)}/accept`,
    { method: "POST" },
  )
  return response.data
}
