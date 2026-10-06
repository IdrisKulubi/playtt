import { router } from "expo-router"
import { apiFetch } from "@/lib/api-client"
import { acceptAuthenticatedSession, markSessionSignedOut } from "@/lib/auth-session-state"
import { routeAfterAuth, resolvePostAuthRoute } from "@/lib/user-api"
import { setCachedSessionRoute } from "@/lib/session-cache"

jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }))
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }))
jest.mock("@/lib/api-client", () => ({ apiFetch: jest.fn() }))
jest.mock("@/lib/auth-helpers", () => ({ getStoredAuth: async () => ({ token: "old-token" }) }))
jest.mock("@/lib/auth-debug", () => ({ authDebug: jest.fn(), authDebugError: jest.fn() }))
jest.mock("@/lib/auth-navigation", () => ({ AUTHENTICATED_HOME: "/(app)/(tabs)" }))
jest.mock("@/lib/session-cache", () => ({ getCachedSessionRoute: jest.fn(), setCachedSessionRoute: jest.fn() }))

describe("navigation during logout", () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await acceptAuthenticatedSession()
  })

  it.each([routeAfterAuth, resolvePostAuthRoute])("ignores a user request completed after logout", async (resolveRoute) => {
    let finishRequest!: (value: unknown) => void
    jest.mocked(apiFetch).mockImplementation(() => new Promise((resolve) => { finishRequest = resolve }) as never)
    const result = resolveRoute()
    const rejected = expect(result).rejects.toMatchObject({ code: "UNAUTHENTICATED" })
    await markSessionSignedOut()
    finishRequest({ data: { user: { id: "old-user" }, route: "/(app)/(tabs)" } })
    await rejected
    expect(router.replace).not.toHaveBeenCalled()
    expect(setCachedSessionRoute).not.toHaveBeenCalled()
  })
})
