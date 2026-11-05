import * as SecureStore from "expo-secure-store"
import { router } from "expo-router"
import { authClient } from "@/lib/auth-client"
import { clearSession, getStoredAuth } from "@/lib/auth-helpers"
import { acceptAuthenticatedSession } from "@/lib/auth-session-state"

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }))
jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }))
jest.mock("@/lib/auth-client", () => ({ authClient: { getCookie: jest.fn(), signOut: jest.fn() } }))
jest.mock("@/lib/auth-debug", () => ({ authDebug: jest.fn(), authDebugError: jest.fn() }))

describe("stored authentication", () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    await acceptAuthenticatedSession()
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) =>
      key === "playtt_session"
        ? JSON.stringify({ session: { token: "old-apple-token" } })
        : null,
    )
  })

  it("uses the new Google cookie ahead of a stale custom Apple session", async () => {
    jest.mocked(authClient.getCookie).mockResolvedValue(
      "better-auth.session_data=cached-data; __Secure-better-auth.session_token=new-google-token.signature",
    )
    expect(await getStoredAuth()).toMatchObject({ token: "new-google-token", source: "cookie" })
  })

  it("keeps custom Apple sessions usable when no Better Auth cookie exists", async () => {
    jest.mocked(authClient.getCookie).mockResolvedValue("")
    expect(await getStoredAuth()).toMatchObject({ token: "old-apple-token", source: "session" })
  })

  it("does not use an expired locally stored Apple session", async () => {
    jest.mocked(authClient.getCookie).mockResolvedValue("")
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) =>
      key === "playtt_session"
        ? JSON.stringify({ session: { token: "old-apple-token", expiresAt: "2020-01-01T00:00:00.000Z" } })
        : null,
    )

    expect(await getStoredAuth()).toBeNull()
  })

  it("ignores malformed cookie encoding without blocking the auth screen", async () => {
    jest.mocked(authClient.getCookie).mockResolvedValue("better-auth.session_token=%invalid")
    expect(await getStoredAuth()).toMatchObject({ token: "old-apple-token" })
  })

  it("does not restore auth when a late session refresh rewrites cookies after logout", async () => {
    jest.mocked(authClient.getCookie).mockResolvedValue("better-auth.session_token=old-token.signature")
    await clearSession()
    // Simulate the old get-session response restoring its cookie after deletion.
    jest.mocked(authClient.getCookie).mockResolvedValue("better-auth.session_token=old-token.signature")
    expect(await getStoredAuth()).toBeNull()
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("playtt_signed_out", "1")
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("playtt_session_route_cache_v1")
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("playtt_profile_cache_v1")
    expect(router.replace).toHaveBeenCalledWith("/sign-in")

    jest.mocked(authClient.getCookie).mockResolvedValue("better-auth.session_token=new-token.signature")
    await acceptAuthenticatedSession()
    expect(await getStoredAuth()).toMatchObject({ token: "new-token", source: "cookie" })
  })

  it("still signs out locally when revoking the remote session fails", async () => {
    jest.mocked(authClient.signOut).mockRejectedValue(new Error("Network request failed"))
    jest.mocked(authClient.getCookie).mockResolvedValue("better-auth.session_token=old-token.signature")
    await clearSession()
    expect(await getStoredAuth()).toBeNull()
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("playtt_session")
  })
})
