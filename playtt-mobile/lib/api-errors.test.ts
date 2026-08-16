import { formatApiFailure } from "@/lib/api-errors"

describe("formatApiFailure", () => {
  it("maps known API codes to stable messages", () => {
    expect(
      formatApiFailure({
        status: 409,
        code: "SLOT_UNAVAILABLE",
        message: "Request failed with status 409",
      }),
    ).toBe("That time slot is no longer available. Pick another time.")
  })

  it("preserves explicit server messages", () => {
    expect(
      formatApiFailure({
        status: 400,
        message: "Custom booking error.",
      }),
    ).toBe("Custom booking error.")
  })
})
