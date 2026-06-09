import type { AuthThemeColors } from "@/constants/auth-theme"
import { PlayTTColors } from "@/constants/playtt-tokens"

export const AccountFormTheme: AuthThemeColors = {
  pageBackground: PlayTTColors.background,
  foreground: PlayTTColors.foreground,
  muted: PlayTTColors.mutedText,
  fieldFill: PlayTTColors.input,
  fieldFillFocused: PlayTTColors.card,
  socialFill: PlayTTColors.input,
  divider: PlayTTColors.border,
  primary: PlayTTColors.primary,
  primaryForeground: PlayTTColors.primaryForeground,
  destructive: PlayTTColors.destructive,
  link: PlayTTColors.primary,
  statusBar: "light",
}
