import { bookingIdFromNotificationData } from "@/lib/notification-deep-link"

describe("notification deep links", () => {
  it("accepts only a non-empty booking id", () => {
    expect(bookingIdFromNotificationData({ bookingId: "booking-1" })).toBe("booking-1")
    expect(bookingIdFromNotificationData({ bookingId: "" })).toBeNull()
    expect(bookingIdFromNotificationData({ bookingId: 1 })).toBeNull()
    expect(bookingIdFromNotificationData(null)).toBeNull()
  })
})
