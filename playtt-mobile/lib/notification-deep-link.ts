import { communityChatHref, communityPlayerHref } from "@/lib/community-types"

function stringField(data: unknown, key: string) {
  if (!data || typeof data !== "object") return null
  const value = (data as Record<string, unknown>)[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

export function bookingIdFromNotificationData(data: unknown) {
  return stringField(data, "bookingId")
}

/**
 * Where a tapped push should open. Community pushes carry `conversationId`
 * (chat) or `playerId` (profile); booking pushes carry `bookingId`.
 */
export function notificationTarget(data: unknown):
  | { kind: "booking"; bookingId: string }
  | { kind: "community"; href: string }
  | null {
  const conversationId = stringField(data, "conversationId")
  if (conversationId) return { kind: "community", href: communityChatHref(conversationId) }

  const playerId = stringField(data, "playerId")
  if (playerId) return { kind: "community", href: communityPlayerHref(playerId) }

  const bookingId = bookingIdFromNotificationData(data)
  if (bookingId) return { kind: "booking", bookingId }

  return null
}
