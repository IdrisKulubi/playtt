import { formatPaymentStatus } from "@/lib/booking-utils"

describe("formatPaymentStatus", () => {
  it("keeps unknown payment statuses readable", () => {
    expect(formatPaymentStatus("awaiting_capture")).toBe("awaiting capture")
  })

  it("maps known payment statuses", () => {
    expect(formatPaymentStatus("paid")).toBe("Paid")
    expect(formatPaymentStatus("unpaid")).toBe("Unpaid")
  })
})
