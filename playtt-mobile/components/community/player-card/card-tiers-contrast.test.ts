import { contrastRatio } from "@/lib/color-contrast"

import { CARD_TIERS, CARD_TIER_ORDER } from "./card-tiers"

/** Flattens "rgba(r, g, b, a)" over an opaque #rrggbb background. */
function flatten(color: string, background: string) {
  const match = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(color)
  if (!match) return color
  const [r, g, b, a] = match.slice(1).map(Number)
  const bg = [1, 3, 5].map((i) => parseInt(background.slice(i, i + 2), 16))
  const mixed = [r, g, b].map((channel, i) => Math.round(channel * a + bg[i] * (1 - a)))
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`
}

// Card text sits anywhere between the gradient's two stops, so check both.
const cases = CARD_TIER_ORDER.flatMap((tier) =>
  (["light", "dark"] as const).flatMap((scheme) =>
    CARD_TIERS[tier][scheme].gradient.map((stop) => ({ tier, scheme, stop, tokens: CARD_TIERS[tier][scheme] })),
  ),
)

describe.each(cases)("$tier card ($scheme) on $stop", ({ stop, tokens }) => {
  it("name and numbers are at least 7:1", () => {
    expect(contrastRatio(flatten(tokens.text, stop), stop)).toBeGreaterThanOrEqual(7)
  })

  it("secondary text is at least 4.5:1", () => {
    expect(contrastRatio(flatten(tokens.muted, stop), stop)).toBeGreaterThanOrEqual(4.5)
  })

  it("tier colour is at least 3:1 (bold labels, rings and icons)", () => {
    expect(contrastRatio(flatten(tokens.accent, stop), stop)).toBeGreaterThanOrEqual(3)
  })
})
