import * as MediaLibrary from "expo-media-library"
import * as Sharing from "expo-sharing"
import { Platform } from "react-native"

export type StatsShareData = {
  periodLabel: string
  sessions: number
  minutes: number
  spendingKes: number
  preview: boolean
}

export function shareTimeLabel(minutes: number): string {
  const total = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0
  const hours = Math.floor(total / 60)
  const remainder = total % 60
  return hours
    ? `${hours}h${remainder ? ` ${remainder}m` : ""}`
    : `${remainder}m`
}

export async function shareStatsImage(
  uri: string,
  isCurrent: () => boolean = () => true
): Promise<void> {
  if (Platform.OS === "web" || !(await Sharing.isAvailableAsync())) {
    throw new Error("Image sharing is available in the PlayTT mobile app.")
  }
  if (!isCurrent()) return
  await Sharing.shareAsync(uri, {
    mimeType: "image/png",
    UTI: "public.png",
    dialogTitle: "Share your PlayTT activity",
  })
}

export async function saveStatsImage(
  uri: string,
  isCurrent: () => boolean = () => true
): Promise<void> {
  if (Platform.OS === "web")
    throw new Error("Save images from the PlayTT mobile app.")
  const permission = await MediaLibrary.requestPermissionsAsync(true, ["photo"])
  if (!permission.granted) {
    throw new Error(
      "Allow PlayTT to add photos in Settings, or use Share image instead."
    )
  }
  if (!isCurrent()) return
  await MediaLibrary.Asset.create(uri)
}
