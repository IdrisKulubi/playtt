import { act, render, waitFor } from "@testing-library/react-native"
import { router } from "expo-router"
import IndexScreen from "@/app/index"
import { useSession } from "@/lib/auth-client"
import { getStoredAuth, waitForStoredAuth } from "@/lib/auth-helpers"
import { resolvePostAuthRoute } from "@/lib/user-api"

jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}))
jest.mock("@/components/auth/auth-shell", () => ({ AuthShell: ({ children }: { children: unknown }) => children }))
jest.mock("@/components/auth/auth-form", () => ({ AuthForm: () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Load inside the hoisted Jest mock.
  const { Text } = require("react-native")
  return <Text>Sign in form</Text>
} }))
jest.mock("@/hooks/use-splash-hold", () => ({ useSplashHold: jest.fn() }))
jest.mock("@/lib/auth-client", () => ({ useSession: jest.fn() }))
jest.mock("@/lib/auth-debug", () => ({ authDebug: jest.fn(), authDebugError: jest.fn() }))
jest.mock("@/lib/auth-helpers", () => ({ getStoredAuth: jest.fn(), waitForStoredAuth: jest.fn() }))
jest.mock("@/lib/toast", () => ({ toast: { apiError: jest.fn() } }))
jest.mock("@/lib/user-api", () => ({ resolvePostAuthRoute: jest.fn() }))
jest.mock("@/lib/welcome-storage", () => ({ getHasSeenWelcome: async () => true }))

describe("expired auth bootstrap", () => {
  beforeEach(() => { jest.clearAllMocks() })

  it("shows sign in instead of routing a rejected stored token back into the app", async () => {
    jest.mocked(useSession).mockReturnValue({ data: null, isPending: false } as never)
    jest.mocked(getStoredAuth).mockResolvedValue({ token: "expired", source: "session" })
    jest.mocked(resolvePostAuthRoute).mockRejectedValue(new Error("Session expired"))
    const screen = render(<IndexScreen />)
    await waitFor(() => expect(screen.getByText("Sign in form")).toBeTruthy(), { timeout: 5000 })
    expect(router.replace).not.toHaveBeenCalled()
  })

  it("releases bootstrap when clearing auth changes the session during route resolution", async () => {
    let rejectRoute!: (error: Error) => void
    jest.mocked(useSession).mockReturnValue({ data: { session: {} }, isPending: false } as never)
    jest.mocked(getStoredAuth).mockResolvedValue({ token: "expired", source: "session" })
    jest.mocked(waitForStoredAuth).mockResolvedValue({ token: "expired", source: "session" })
    jest.mocked(resolvePostAuthRoute).mockImplementation(() => new Promise((_, reject) => { rejectRoute = reject }))
    const screen = render(<IndexScreen />)
    await waitFor(() => expect(resolvePostAuthRoute).toHaveBeenCalled())
    jest.mocked(useSession).mockReturnValue({ data: null, isPending: false } as never)
    jest.mocked(getStoredAuth).mockResolvedValue(null)
    screen.rerender(<IndexScreen />)
    await act(async () => { rejectRoute(new Error("Session expired")) })
    await waitFor(() => expect(screen.getByText("Sign in form")).toBeTruthy(), { timeout: 5000 })
    expect(router.replace).not.toHaveBeenCalled()
  })
})
