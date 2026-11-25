// Venue TV themes. A theme is a renderer (the motion) plus a palette (the
// colours), so a new look such as "Christmas Silk" is data, not code.
// Safe to import from both server and client.

export const THEME_RENDERERS = ["liquid_glass", "silk", "rally_ripples"] as const
export type ThemeRenderer = (typeof THEME_RENDERERS)[number]

export const RENDERER_LABELS: Record<ThemeRenderer, string> = {
  liquid_glass: "Liquid Glass",
  silk: "Silk",
  rally_ripples: "Rally Ripples",
}

export const RENDERER_DESCRIPTIONS: Record<ThemeRenderer, string> = {
  liquid_glass: "Frosted glass spheres drift over a colour field.",
  silk: "A wide ribbon folds across a light field, lit like fabric.",
  rally_ripples: "Light bounces in a rally rhythm, sending rings across the screen.",
}

/** Four colours drive every renderer. */
export interface ThemePalette {
  /** The field behind everything. */
  base: string
  /** The hero colour: ribbon, rings, main glow. */
  accent: string
  /** Highlights: light blooms, ribbon sheen, glass shine. */
  light: string
  /** Depth: shadows, folds, the deep end of gradients. */
  deep: string
}

export type ThemeInk = "light" | "dark"

export interface DisplayTheme {
  /** "builtin:<renderer>" for built-ins, otherwise the display_themes id. */
  key: string
  name: string
  renderer: ThemeRenderer
  palette: ThemePalette
  /** Text colour on top: white ("light") or navy ("dark"). */
  ink: ThemeInk
  builtIn: boolean
}

export const BUILT_IN_THEMES: DisplayTheme[] = [
  {
    key: "builtin:liquid_glass",
    name: "Liquid Glass",
    renderer: "liquid_glass",
    palette: { base: "#00b7ff", accent: "#0076de", light: "#ffffff", deep: "#0048b2" },
    ink: "light",
    builtIn: true,
  },
  {
    key: "builtin:silk",
    name: "Silk",
    renderer: "silk",
    palette: { base: "#ffffff", accent: "#00b7ff", light: "#d6f3ff", deep: "#0076de" },
    ink: "dark",
    builtIn: true,
  },
  {
    key: "builtin:rally_ripples",
    name: "Rally Ripples",
    renderer: "rally_ripples",
    palette: { base: "#e6f7ff", accent: "#00b7ff", light: "#ffffff", deep: "#0076de" },
    ink: "dark",
    builtIn: true,
  },
]

export const DEFAULT_THEME_KEY = "builtin:liquid_glass"

export function builtInTheme(key: string | null | undefined): DisplayTheme | null {
  return BUILT_IN_THEMES.find((theme) => theme.key === key) ?? null
}

export function defaultTheme(): DisplayTheme {
  return builtInTheme(DEFAULT_THEME_KEY)!
}

export function isThemeRenderer(value: unknown): value is ThemeRenderer {
  return typeof value === "string" && (THEME_RENDERERS as readonly string[]).includes(value)
}

const HEX = /^#[0-9a-f]{6}$/i

export function isHexColour(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value)
}

/** Fills any missing or invalid colour from the renderer's built-in palette. */
export function normalisePalette(
  renderer: ThemeRenderer,
  palette: Partial<Record<keyof ThemePalette, unknown>> | null | undefined,
): ThemePalette {
  const fallback = builtInTheme(`builtin:${renderer}`)!.palette
  const pick = (key: keyof ThemePalette) => {
    const value = palette?.[key]
    return isHexColour(value) ? value.toLowerCase() : fallback[key]
  }
  return { base: pick("base"), accent: pick("accent"), light: pick("light"), deep: pick("deep") }
}

/** Relative luminance (WCAG) of a #rrggbb colour. */
export function luminance(hex: string) {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2)
}

/** Text colour that reads best on a field of this colour. */
export function suggestedInk(base: string): ThemeInk {
  return luminance(base) > 0.45 ? "dark" : "light"
}

/** Ready-made starting points for new themes. */
export const PALETTE_PRESETS: { name: string; palette: ThemePalette }[] = [
  { name: "PlayTT Azure", palette: { base: "#00b7ff", accent: "#0076de", light: "#ffffff", deep: "#0048b2" } },
  { name: "Christmas", palette: { base: "#b3122e", accent: "#1f7a3a", light: "#fff4e0", deep: "#5c0a19" } },
  { name: "Sunset", palette: { base: "#ff7a45", accent: "#ff3d6e", light: "#ffe3b8", deep: "#8a1c4a" } },
  { name: "Mint", palette: { base: "#e9fff6", accent: "#00c48c", light: "#ffffff", deep: "#00785a" } },
  { name: "Midnight", palette: { base: "#0b1627", accent: "#00b7ff", light: "#9fe4ff", deep: "#041019" } },
]
