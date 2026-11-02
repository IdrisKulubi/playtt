import { AppColors, type ColorRoles } from "@/constants/colors"
import { contrastRatio } from "@/lib/color-contrast"

// Redesign Phase 0 gate: every text role readable on every surface it sits on.
const TEXT_ROLES: (keyof ColorRoles)[] = [
  "label",
  "secondaryLabel",
  "accentText",
  "success",
  "warning",
  "destructive",
]
const SURFACES: (keyof ColorRoles)[] = ["background", "surface", "surfaceElevated"]

describe.each(["light", "dark"] as const)("%s theme contrast", (scheme) => {
  const colors = AppColors[scheme]

  it.each(TEXT_ROLES.flatMap((text) => SURFACES.map((surface) => [text, surface])))(
    "%s on %s is at least 4.5:1",
    (text, surface) => {
      expect(contrastRatio(colors[text], colors[surface])).toBeGreaterThanOrEqual(4.5)
    },
  )

  it.each(SURFACES)("label on %s is at least 7:1", (surface) => {
    expect(contrastRatio(colors.label, colors[surface])).toBeGreaterThanOrEqual(7)
  })

  it("main button text on accent is at least 7:1", () => {
    expect(contrastRatio(colors.onAccent, colors.accent)).toBeGreaterThanOrEqual(7)
  })
})

describe("contrastRatio", () => {
  it("matches the WCAG extremes", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5)
    expect(contrastRatio("#777777", "#777777")).toBe(1)
  })

  it("rejects colours with alpha", () => {
    expect(() => contrastRatio("rgba(0,0,0,0.5)", "#FFFFFF")).toThrow()
  })
})
