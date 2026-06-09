import { PlayTTColors } from "@/constants/playtt-tokens"

export type ProductThemeColors = {
  background: string
  elevated: string
  card: string
  foreground: string
  muted: string
  border: string
  input: string
  backdrop: string
  statusBar: "light" | "dark"
}

export const ProductThemes = {
  light: {
    background: PlayTTColors.productBackground,
    elevated: PlayTTColors.productElevated,
    card: PlayTTColors.productCard,
    foreground: PlayTTColors.productForeground,
    muted: PlayTTColors.productMuted,
    border: PlayTTColors.productBorder,
    input: PlayTTColors.productInput,
    backdrop: "rgba(7, 17, 29, 0.55)",
    statusBar: "dark",
  },
  dark: {
    background: PlayTTColors.background,
    elevated: PlayTTColors.backgroundElevated,
    card: PlayTTColors.card,
    foreground: PlayTTColors.foreground,
    muted: PlayTTColors.mutedText,
    border: PlayTTColors.border,
    input: PlayTTColors.input,
    backdrop: "rgba(0, 0, 0, 0.65)",
    statusBar: "light",
  },
} as const satisfies Record<"light" | "dark", ProductThemeColors>
