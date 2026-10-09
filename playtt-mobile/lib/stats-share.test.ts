import * as MediaLibrary from "expo-media-library"
import * as Sharing from "expo-sharing"
import { saveStatsImage, shareStatsImage, shareTimeLabel } from "./stats-share"

jest.mock("react-native", () => ({ Platform: { OS: "ios" } }))
jest.mock("expo-media-library", () => ({
  requestPermissionsAsync: jest.fn(),
  Asset: { create: jest.fn() },
}))
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}))

beforeEach(() => {
  jest.clearAllMocks()
  jest
    .mocked(MediaLibrary.requestPermissionsAsync)
    .mockResolvedValue({ granted: true } as Awaited<
      ReturnType<typeof MediaLibrary.requestPermissionsAsync>
    >)
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true)
})

test.each([
  [0, "0m"],
  [59, "59m"],
  [60, "1h"],
  [90, "1h 30m"],
  [-1, "0m"],
  [NaN, "0m"],
  [Infinity, "0m"],
])("formats booked minutes %s as %s", (minutes, expected) => {
  expect(shareTimeLabel(minutes as number)).toBe(expected)
})

test("does not save when photo permission is denied", async () => {
  jest
    .mocked(MediaLibrary.requestPermissionsAsync)
    .mockResolvedValue({ granted: false } as Awaited<
      ReturnType<typeof MediaLibrary.requestPermissionsAsync>
    >)
  await expect(saveStatsImage("file:///stats.png")).rejects.toThrow(
    "Allow PlayTT"
  )
  expect(MediaLibrary.Asset.create).not.toHaveBeenCalled()
})

test("requests only write access and creates the PNG asset", async () => {
  await saveStatsImage("file:///stats.png")
  expect(MediaLibrary.requestPermissionsAsync).toHaveBeenCalledWith(true, [
    "photo",
  ])
  expect(MediaLibrary.Asset.create).toHaveBeenCalledWith("file:///stats.png")
})

test("discards a stale export after photo permission resolves", async () => {
  let current = true
  jest
    .mocked(MediaLibrary.requestPermissionsAsync)
    .mockImplementation(async () => {
      current = false
      return { granted: true } as Awaited<
        ReturnType<typeof MediaLibrary.requestPermissionsAsync>
      >
    })
  await saveStatsImage("file:///stats.png", () => current)
  expect(MediaLibrary.Asset.create).not.toHaveBeenCalled()
})

test("does not invoke sharing when native sharing is unavailable", async () => {
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false)
  await expect(shareStatsImage("file:///stats.png")).rejects.toThrow(
    "mobile app"
  )
  expect(Sharing.shareAsync).not.toHaveBeenCalled()
})

test("discards a stale export after sharing availability resolves", async () => {
  let current = true
  jest.mocked(Sharing.isAvailableAsync).mockImplementation(async () => {
    current = false
    return true
  })
  await shareStatsImage("file:///stats.png", () => current)
  expect(Sharing.shareAsync).not.toHaveBeenCalled()
})

test("shares as PNG with the platform type identifier", async () => {
  await shareStatsImage("file:///stats.png")
  expect(Sharing.shareAsync).toHaveBeenCalledWith(
    "file:///stats.png",
    expect.objectContaining({ mimeType: "image/png", UTI: "public.png" })
  )
})

