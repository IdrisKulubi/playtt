import type { AppColorScheme } from "@/constants/theme"

export function liquidGlassLabelColor(
  colorScheme: AppColorScheme,
  active: boolean,
) {
  if (colorScheme === "dark") {
    return active ? "#FFFFFF" : "rgba(255, 255, 255, 0.55)"
  }
  return active ? "#0A1628" : "rgba(10, 22, 40, 0.62)"
}

export function liquidGlassSelectionChipColor(colorScheme: AppColorScheme) {
  return colorScheme === "dark"
    ? "rgba(255, 255, 255, 0.16)"
    : "rgba(10, 22, 40, 0.1)"
}

export function liquidGlassPillBorderColor(colorScheme: AppColorScheme) {
  return colorScheme === "dark"
    ? "rgba(255, 255, 255, 0.1)"
    : "rgba(10, 22, 40, 0.06)"
}
