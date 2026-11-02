import { createContext, use } from "react"

import { AppColors, type ColorRoles } from "@/constants/colors"
import { resolveColorScheme, type AppColorScheme } from "@/constants/theme"
import { useColorScheme } from "@/hooks/use-color-scheme"

export type AppTheme = {
  scheme: AppColorScheme
  colors: ColorRoles
}

const ForcedSchemeContext = createContext<AppColorScheme | null>(null)

/**
 * Pins kit components below it to one scheme, for surfaces that are always
 * dark by design (the welcome screen over its venue photo).
 * Usage: `<ForceColorScheme value="dark">…</ForceColorScheme>`.
 */
export const ForceColorScheme = ForcedSchemeContext.Provider

/** Redesign theme: follows the phone's light/dark setting unless a parent forces one. */
export function useAppTheme(): AppTheme {
  const forced = use(ForcedSchemeContext)
  const system = resolveColorScheme(useColorScheme())
  const scheme = forced ?? system
  return { scheme, colors: AppColors[scheme] }
}
