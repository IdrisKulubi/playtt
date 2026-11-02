import type { TextStyle } from "react-native"

import { PlayTTFontFamilies } from "@/constants/playtt-tokens"

/**
 * Apple-style type scale (iOS default Dynamic Type sizes at "Large").
 *
 * Interface text uses the platform system font (SF Pro on iOS, Roboto on
 * Android) so it picks up optical sizing and the user's text-size setting.
 * Space Grotesk is reserved for brand moments via the `brand*` variants.
 *
 * Tracking is only applied to brand variants: SF Pro and Roboto both ship
 * their own size-specific tracking, so adding SF's table on top would double
 * it on iOS and fight Roboto's metrics on Android.
 */

export type TypeVariant =
  | "largeTitle"
  | "title1"
  | "title2"
  | "title3"
  | "headline"
  | "body"
  | "callout"
  | "subheadline"
  | "footnote"
  | "caption"
  | "brandDisplay"
  | "brandTitle"

type TypeSpec = {
  fontSize: number
  lineHeight: number
  fontWeight: NonNullable<TextStyle["fontWeight"]>
  /** SF Pro tracking at this size, in points. */
  tracking: number
  /** Brand variants render in Space Grotesk instead of the system font. */
  brand?: boolean
}

export const TypeScale: Record<TypeVariant, TypeSpec> = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: "700", tracking: 0.4 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: "700", tracking: 0.38 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: "700", tracking: -0.26 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: "600", tracking: -0.45 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600", tracking: -0.43 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: "400", tracking: -0.43 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: "400", tracking: -0.31 },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: "400", tracking: -0.23 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: "400", tracking: -0.08 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400", tracking: 0 },
  // Brand moments only: wordmark, welcome headline, share-card scores.
  brandDisplay: { fontSize: 40, lineHeight: 42, fontWeight: "700", tracking: -0.8, brand: true },
  brandTitle: { fontSize: 28, lineHeight: 32, fontWeight: "600", tracking: -0.42, brand: true },
}

/** Chrome (tab bar, segment pills) may grow, but not without limit. */
export const CHROME_MAX_FONT_SCALE = 1.5

function brandFamily(weight: TypeSpec["fontWeight"]): string {
  if (weight === "700" || weight === "bold") return PlayTTFontFamilies.bold
  if (weight === "600") return PlayTTFontFamilies.semiBold
  if (weight === "500") return PlayTTFontFamilies.medium
  return PlayTTFontFamilies.regular
}

export function typeStyle(
  variant: TypeVariant,
  weight?: TypeSpec["fontWeight"],
): TextStyle {
  const spec = TypeScale[variant]
  const fontWeight = weight ?? spec.fontWeight

  if (spec.brand) {
    // Custom fonts carry weight in the family name; fontWeight would fake-bold.
    return {
      fontFamily: brandFamily(fontWeight),
      fontSize: spec.fontSize,
      lineHeight: spec.lineHeight,
      letterSpacing: spec.tracking,
    }
  }

  return {
    fontSize: spec.fontSize,
    lineHeight: spec.lineHeight,
    fontWeight,
  }
}
