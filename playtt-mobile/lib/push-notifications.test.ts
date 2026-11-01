import { bookingIdFromNotificationData, notificationTarget } from "@/lib/notification-deep-link"

describe("notification deep links", () => {
  it("accepts only a non-empty booking id", () => {
    expect(bookingIdFromNotificationData({ bookingId: "booking-1" })).toBe("booking-1")
    expect(bookingIdFromNotificationData({ bookingId: "" })).toBeNull()
    expect(bookingIdFromNotificationData({ bookingId: 1 })).toBeNull()
    expect(bookingIdFromNotificationData(null)).toBeNull()
  })

  it("routes community pushes to the chat or the player profile", () => {
    expect(notificationTarget({ conversationId: "c/1" })).toEqual({
      kind: "community",
      href: "/community/chat/c%2F1",
    })
    expect(notificationTarget({ playerId: "user_amara" })).toEqual({
      kind: "community",
      href: "/community/player/user_amara",
    })
    expect(notificationTarget({ bookingId: "booking-1" })).toEqual({ kind: "booking", bookingId: "booking-1" })
    // A chat push wins if a payload somehow carries both.
    expect(notificationTarget({ conversationId: "c1", bookingId: "b1" })?.kind).toBe("community")
    expect(notificationTarget({})).toBeNull()
  })
})
