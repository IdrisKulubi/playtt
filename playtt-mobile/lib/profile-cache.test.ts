import * as SecureStore from "expo-secure-store"

import {
  clearCachedUserProfile,
  getCachedUserProfile,
  setCachedUserProfile,
  updateCachedUserProfile,
} from "@/lib/profile-cache"

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

const profile = {
  id: "user-1",
  name: "Amina",
  email: "amina@example.com",
  emailVerified: true,
  image: null,
}

describe("profile cache", () => {
  beforeEach(() => jest.clearAllMocks())

  it("stores the last verified profile in encrypted storage", async () => {
    await setCachedUserProfile(profile)

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "playtt_profile_cache_v1",
      expect.stringContaining('"id":"user-1"'),
    )
  })

  it("returns null for invalid cached data", async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue("not json")
    expect(await getCachedUserProfile()).toBeNull()
  })

  it("updates the cached profile and clears it on sign-out", async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({ user: profile, cachedAt: "2026-01-01T00:00:00.000Z" }),
    )

    await updateCachedUserProfile({ image: "https://example.com/profile.jpg" })
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "playtt_profile_cache_v1",
      expect.stringContaining("profile.jpg"),
    )

    await clearCachedUserProfile()
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("playtt_profile_cache_v1")
  })
})
