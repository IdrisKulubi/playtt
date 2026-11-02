import { AppColors, type ColorRoles } from "@/constants/colors"
import { resolveColorScheme, type AppColorScheme } from "@/constants/theme"
import { useColorScheme } from "@/hooks/use-color-scheme"

export type AppTheme = {
  scheme: AppColorScheme
  colors: ColorRoles
}

/** Redesign theme: follows the phone's light/dark setting everywhere. */
export function useAppTheme(): AppTheme {
  const scheme = resolveColorScheme(useColorScheme())
  return { scheme, colors: AppColors[scheme] }
}
