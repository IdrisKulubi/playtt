// One place for the look of every PlayTT email. Email clients ignore CSS
// variables and most stylesheets, so these are inlined by the components.

export const font =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
export const displayFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
export const monoFont = '"SF Mono", ui-monospace, Menlo, Consolas, "Liberation Mono", monospace'

export const color = {
  /** Page behind the card: Apple's soft grey. */
  canvas: "#f5f5f7",
  card: "#ffffff",
  /** Brand navy for text. */
  ink: "#041019",
  inkSoft: "#424245",
  inkFaint: "#6e6e73",
  inkFainter: "#86868b",
  hairline: "#e5e5ea",
  /** Brand cyan, used for the one action in each email. */
  accent: "#00b7ff",
  accentInk: "#041019",
  /** Quiet surfaces inside the card (code, summary). */
  well: "#f5f5f7",
  navy: "#041019",
} as const

export const space = {
  cardX: "40px",
  cardY: "44px",
} as const

/** Public URL of the deployed site, for images and links. */
export function siteUrl(path = "/") {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "https://www.theplaytt.com"
  return new URL(path, base).toString()
}

/** Images must come from the live site: email clients can't reach localhost. */
export const assetUrl = (path: string) => new URL(path, "https://www.theplaytt.com").toString()
