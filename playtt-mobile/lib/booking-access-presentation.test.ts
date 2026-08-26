import { formatAccessWindow, getBookingAccessPresentation } from "@/lib/booking-access-presentation"
import { BOOKING_ACCESS_STATUSES } from "@/lib/booking-access-types"

describe("booking access presentation", () => {
  it.each(BOOKING_ACCESS_STATUSES)("renders the %s state", (status) => {
    expect(getBookingAccessPresentation(status).title).toBeTruthy()
    expect(getBookingAccessPresentation(status).body).toBeTruthy()
  })

  it("rejects incomplete or invalid validity windows", () => {
    expect(formatAccessWindow(null, null)).toBeNull()
    expect(formatAccessWindow("not-a-date", "also-not-a-date")).toBeNull()
  })

  it("formats a valid access window", () => {
    expect(formatAccessWindow("2026-08-26T10:55:00.000Z", "2026-08-26T12:05:00.000Z")).toContain("–")
  })
})
