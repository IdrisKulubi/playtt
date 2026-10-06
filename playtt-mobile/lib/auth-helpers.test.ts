import * as SecureStore from "expo-secure-store"
import { authClient } from "@/lib/auth-client"
import { getStoredAuth } from "@/lib/auth-helpers"

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn() }))
jest.mock("@/lib/auth-client", () => ({ authClient: { getCookie: jest.fn() } }))
jest.mock("@/lib/auth-debug", () => ({ authDebug: jest.fn(), authDebugError: jest.fn() }))

describe("stored authentication", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) =>
      key === "playtt_session"
        ? JSON.stringify({ session: { token: "old-apple-token" } })
        : null,
    )
  })

  it("uses the new Google cookie ahead of a stale custom Apple session", async () => {
    jest.mocked(authClient.getCookie).mockReturnValue(
      "better-auth.session_data=cached-data; __Secure-better-auth.session_token=new-google-token.signature",
    )
    expect(await getStoredAuth()).toMatchObject({ token: "new-google-token", source: "cookie" })
  })

  it("keeps custom Apple sessions usable when no Better Auth cookie exists", async () => {
    jest.mocked(authClient.getCookie).mockReturnValue("")
    expect(await getStoredAuth()).toMatchObject({ token: "old-apple-token", source: "session" })
  })

  it("ignores malformed cookie encoding without blocking the auth screen", async () => {
    jest.mocked(authClient.getCookie).mockReturnValue("better-auth.session_token=%invalid")
    expect(await getStoredAuth()).toMatchObject({ token: "old-apple-token" })
  })
})
