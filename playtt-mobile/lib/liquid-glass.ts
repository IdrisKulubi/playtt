import Constants, { ExecutionEnvironment } from "expo-constants"
import { Platform } from "react-native"

import type { AppColorScheme } from "@/constants/theme"

export type LiquidGlassVariant = "regular" | "clear"

export const TAB_SYSTEM_ICONS = {
  index: "house.fill",
  bookings: "calendar",
  activity: "chart.bar.fill",
  community: "person.2.fill",
  account: "person.fill",
} as const

function getIOSMajorVersion(): number | null {
  if (Platform.OS !== "ios") {
    return null
  }

  const version = Platform.Version
  if (typeof version === "string") {
    const major = Number.parseInt(version.split(".")[0] ?? "", 10)
    return Number.isFinite(major) ? major : null
  }

  return typeof version === "number" ? version : null
}

function isRunningInExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient
}

export function canUseLiquidGlass(): boolean {
  if (Platform.OS !== "ios") {
    return false
  }

  // @expo/ui SwiftUI is not bundled in Expo Go on SDK 54 — use blur fallbacks there.
  if (isRunningInExpoGo()) {
    return false
  }

  const major = getIOSMajorVersion()
  return major !== null && major >= 26
}

export function glassVariantForScheme(
  colorScheme: AppColorScheme,
): LiquidGlassVariant {
  return colorScheme === "dark" ? "clear" : "regular"
}
