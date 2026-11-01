import * as SecureStore from "expo-secure-store"

import { inviteShareMessage, normalizeInviteCode, savePendingInvite, takePendingInvite } from "./community-invite"

jest.mock("@/lib/community-api", () => ({ createInvite: jest.fn() }))
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>()
  return {
    setItemAsync: jest.fn(async (key: string, value: string) => void store.set(key, value)),
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key: string) => void store.delete(key)),
  }
})

test("invite codes are normalised the same way as on the server", () => {
  expect(normalizeInviteCode(" k7qm-2xhp ")).toBe("K7QM2XHP")
  expect(normalizeInviteCode("K7QM2XH0")).toBeNull() // 0 is never used
  expect(normalizeInviteCode("short")).toBeNull()
})

test("the share text carries the invite link", () => {
  expect(inviteShareMessage("https://playtt.invalid/invite/K7QM2XHP")).toBe(
    "Play table tennis with me on PlayTT 🏓 https://playtt.invalid/invite/K7QM2XHP",
  )
})

test("a pending invite is read once, then cleared", async () => {
  await savePendingInvite("K7QM2XHP")
  expect(await takePendingInvite()).toBe("K7QM2XHP")
  expect(await takePendingInvite()).toBeNull()
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1)
})
