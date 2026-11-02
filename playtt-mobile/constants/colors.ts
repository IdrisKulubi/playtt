import { PlayTTColors } from "@/constants/playtt-tokens"

/**
 * One light/dark theme for the whole app (redesign Phase 0).
 *
 * Rules:
 * - `accent` is for fills (main button, selected tab, progress). Cyan text and
 *   icons use `accentText`, which passes 4.5:1 on light surfaces.
 * - Colour never carries meaning alone: pair status colours with an icon + word.
 * - Every text role is checked against `background` and `surface` in
 *   `constants/colors.test.ts`.
 */

export type ColorRoles = {
  /** The page behind everything. */
  background: string
  /** Cards and grouped lists. */
  surface: string
  /** Sheets and popovers above surfaces. */
  surfaceElevated: string
  label: string
  secondaryLabel: string
  /** Placeholders and disabled text only, never content. */
  tertiaryLabel: string
  separator: string
  /** Tinted fill for secondary buttons and selected rows. */
  fill: string
  accent: string
  /** Text and icons placed on an `accent` fill. */
  onAccent: string
  accentText: string
  success: string
  warning: string
  destructive: string
  /** Dimming layer behind modal tasks. */
  scrim: string
}

export const AppColors: Record<"light" | "dark", ColorRoles> = {
  light: {
    background: "#F2F2F7",
    surface: "#FFFFFF",
    surfaceElevated: "#FFFFFF",
    label: PlayTTColors.productForeground,
    secondaryLabel: PlayTTColors.productMuted,
    tertiaryLabel: "#8A97A8",
    separator: "#D8E0EA",
    fill: "rgba(0, 114, 163, 0.10)",
    accent: PlayTTColors.primary,
    onAccent: PlayTTColors.primaryForeground,
    accentText: "#0072A3",
    success: "#1E7B34",
    warning: "#B25000",
    destructive: "#D70015",
    scrim: "rgba(7, 17, 29, 0.45)",
  },
  dark: {
    background: PlayTTColors.background,
    surface: PlayTTColors.card,
    surfaceElevated: "#16233A",
    label: "#FFFFFF",
    secondaryLabel: PlayTTColors.mutedText,
    tertiaryLabel: "#5E7290",
    separator: PlayTTColors.border,
    fill: "rgba(0, 183, 255, 0.16)",
    accent: PlayTTColors.primary,
    onAccent: PlayTTColors.primaryForeground,
    accentText: PlayTTColors.primary,
    success: "#30D158",
    warning: "#FFD60A",
    destructive: "#FF453A",
    scrim: "rgba(0, 0, 0, 0.6)",
  },
}
