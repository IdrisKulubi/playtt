const mockValues = new Map<string, string>()
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockValues.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => { mockValues.set(key, value) },
  deleteItemAsync: async (key: string) => { mockValues.delete(key) },
}))

it("keeps logout effective after reloading the app until authentication succeeds", async () => {
  mockValues.clear()
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Reload the module to simulate an app restart.
  const initialApp = require("@/lib/auth-session-state") as typeof import("@/lib/auth-session-state")
  await initialApp.markSessionSignedOut()
  jest.resetModules()
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Reload the module to simulate an app restart.
  const restartedApp = require("@/lib/auth-session-state") as typeof import("@/lib/auth-session-state")
  expect(await restartedApp.isSessionSignedOut()).toBe(true)
  await restartedApp.acceptAuthenticatedSession()
  expect(await restartedApp.isSessionSignedOut()).toBe(false)
})
