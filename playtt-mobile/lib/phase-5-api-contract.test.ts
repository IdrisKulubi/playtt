jest.mock("@/lib/api-client", () => ({ apiFetch: jest.fn() }))

import { apiFetch } from "@/lib/api-client"
import { fetchBookingAccess, revealBookingAccess } from "@/lib/booking-access-api"
import { registerPushToken, updateNotificationPreferences } from "@/lib/notification-api"

const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>

describe("Phase 5 mobile API contract", () => {
  beforeEach(() => mockedApiFetch.mockReset())

  it("loads redacted access status and reveals through a separate no-store request", async () => {
    mockedApiFetch
      .mockResolvedValueOnce({ data: { access: { bookingId: "booking/1", status: "ready" } } } as never)
      .mockResolvedValueOnce({ data: { code: "12345678", validFrom: "from", validUntil: "until" } } as never)

    await fetchBookingAccess("booking/1")
    await revealBookingAccess("booking/1")

    expect(mockedApiFetch).toHaveBeenNthCalledWith(1, "/api/bookings/booking%2F1/access")
    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      2,
      "/api/bookings/booking%2F1/access/reveal",
      { method: "POST", headers: { "cache-control": "no-store" } },
    )
  })

  it("uses the server preference and Expo token endpoints", async () => {
    const preferences = {
      accessReady: true,
      accessFailed: true,
      sessionReminder: true,
      sessionWarning: true,
      sessionEnded: true,
      replayReady: true,
    }
    mockedApiFetch
      .mockResolvedValueOnce({ data: { preferences } } as never)
      .mockResolvedValueOnce({ data: { token: { id: "token-1", platform: "ios", enabled: true } } } as never)

    await updateNotificationPreferences(preferences)
    await registerPushToken("ExponentPushToken[fixture]")

    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      1,
      "/api/user/notification-preferences",
      { method: "PATCH", body: JSON.stringify({ preferences }) },
    )
    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      2,
      "/api/user/push-tokens",
      expect.objectContaining({ method: "POST" }),
    )
    const pushBody = JSON.parse(
      (mockedApiFetch.mock.calls[1]?.[1] as RequestInit).body as string,
    )
    expect(pushBody.token).toBe("ExponentPushToken[fixture]")
    expect(["ios", "android", "web", "windows", "macos"]).toContain(pushBody.platform)
  })
})
