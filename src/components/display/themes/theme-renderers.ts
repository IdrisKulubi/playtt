// Drawing for venue TV themes. Each renderer is a pure function of time `t`
// and the theme palette, drawn on a small canvas that is scaled up soft. The
// same code powers the TV, the admin previews and the 4K downloads.

import type { DisplayTheme, ThemePalette } from "@/lib/display-themes"

type RGB = [number, number, number]

const TAU = Math.PI * 2
const WHITE: RGB = [255, 255, 255]

function hexToRgb(hex: string): RGB {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`
const mix = (a: RGB, b: RGB, k: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * k),
  Math.round(a[1] + (b[1] - a[1]) * k),
  Math.round(a[2] + (b[2] - a[2]) * k),
]

type Colours = { base: RGB; accent: RGB; light: RGB; deep: RGB }

function colours(palette: ThemePalette): Colours {
  return {
    base: hexToRgb(palette.base),
    accent: hexToRgb(palette.accent),
    light: hexToRgb(palette.light),
    deep: hexToRgb(palette.deep),
  }
}

type Draw = (ctx: CanvasRenderingContext2D, W: number, H: number, t: number, c: Colours, inkLight: boolean) => void

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: RGB, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, rgba(c, a))
  g.addColorStop(0.5, rgba(c, a * 0.5))
  g.addColorStop(1, rgba(c, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
}

function linear(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: [number, RGB, number?][],
) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  for (const [k, c, a = 1] of stops) g.addColorStop(k, rgba(c, a))
  return g
}

/** Liquid Glass field: saturated colour with soft light blooming through it. */
const liquidGlassField: Draw = (ctx, W, H, t, c, inkLight) => {
  ctx.globalCompositeOperation = "source-over"
  ctx.fillStyle = linear(ctx, 0, H, W, 0, [[0, c.accent], [0.45, c.base], [1, mix(c.base, c.light, 0.4)]])
  ctx.fillRect(0, 0, W, H)
  const m = Math.max(W, H)
  const p = (fx: number, fy: number, ph: number, cx: number, cy: number, ax: number, ay: number) => [
    W * (cx + ax * Math.sin(t * fx * TAU + ph)),
    H * (cy + ay * Math.cos(t * fy * TAU + ph * 1.3)),
  ]
  let q = p(0.009, 0.012, 0.4, 0.15, 0.9, 0.12, 0.1)
  blob(ctx, q[0], q[1], m * 0.55, c.deep, 0.75)
  q = p(0.011, 0.008, 2.2, 0.95, 1.0, 0.1, 0.08)
  blob(ctx, q[0], q[1], m * 0.35, c.accent, 0.6)
  ctx.globalCompositeOperation = "screen"
  q = p(0.013, 0.017, 1.1, 0.72, 0.42, 0.14, 0.16)
  blob(ctx, q[0], q[1], m * 0.42, c.light, 0.7)
  q = p(0.017, 0.011, 3.4, 0.5, 0.75, 0.2, 0.12)
  blob(ctx, q[0], q[1], m * 0.3, mix(c.light, c.base, 0.3), 0.5)
  q = p(0.021, 0.019, 5.0, 0.66, 0.62, 0.1, 0.12)
  blob(ctx, q[0], q[1], m * 0.22, c.light, 0.5)
  ctx.globalCompositeOperation = "source-over"
  // Keep the text areas readable: top-left, top-right and the bottom bar.
  const shade = inkLight ? c.deep : c.light
  ctx.fillStyle = linear(ctx, 0, 0, W * 0.5, H * 0.5, [[0, shade, 0.45], [1, shade, 0]])
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = linear(ctx, W, 0, W * 0.72, H * 0.3, [[0, inkLight ? c.accent : c.light, 0.55], [1, shade, 0]])
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = linear(ctx, 0, H, 0, H * 0.78, [[0, shade, 0.55], [1, shade, 0]])
  ctx.fillRect(0, 0, W, H)
}

/** Silk: one wide ribbon folding across a light field, shaded like fabric. */
const silk: Draw = (ctx, W, H, t, c) => {
  ctx.globalCompositeOperation = "source-over"
  ctx.fillStyle = linear(ctx, 0, 0, W, H, [[0, c.base], [1, mix(c.base, c.light, 0.7)]])
  ctx.fillRect(0, 0, W, H)
  const ribbons = [
    { y: 0.62, amp: 0.16, width: 0.34, f: 0.55, s: 0.011, ph: 0.0, lit: mix(c.accent, c.light, 0.45), dark: c.deep, a: 1 },
    { y: 0.74, amp: 0.1, width: 0.14, f: 0.8, s: -0.015, ph: 2.2, lit: mix(c.light, WHITE, 0.5), dark: c.accent, a: 0.85 },
  ]
  for (const R of ribbons) {
    const centre = (x: number) => {
      const u = x / W
      return H * (R.y + R.amp * Math.sin(u * R.f * TAU + t * R.s * TAU + R.ph) +
        0.05 * Math.sin(u * 2.1 * TAU - t * R.s * 1.6 * TAU + R.ph))
    }
    const twist = (x: number) => Math.sin((x / W) * 1.7 * TAU + t * 0.017 * TAU + R.ph)
    for (let x = -2; x <= W + 2; x += 1) {
      const cy = centre(x)
      const slope = (centre(x + 1) - centre(x - 1)) / 2
      const tw = twist(x)
      const half = (H * R.width * (0.35 + 0.65 * Math.abs(tw))) / 2
      const lightness = Math.max(0, Math.min(1, 0.55 + slope * 0.9 + tw * 0.25))
      const col = mix(R.dark, R.lit, lightness)
      const g = ctx.createLinearGradient(0, cy - half, 0, cy + half)
      g.addColorStop(0, rgba(mix(col, WHITE, 0.35), R.a))
      g.addColorStop(0.5, rgba(col, R.a))
      g.addColorStop(1, rgba(mix(col, c.deep, 0.3), R.a))
      ctx.fillStyle = g
      ctx.fillRect(x, cy - half, 1.6, half * 2)
    }
  }
}

/** Rally Ripples: a light bounces in a rally rhythm; each landing sends rings. */
const rallyRipples: Draw = (ctx, W, H, t, c) => {
  ctx.globalCompositeOperation = "source-over"
  ctx.fillStyle = linear(ctx, 0, 0, W, H, [[0, mix(c.base, c.light, 0.6)], [0.55, c.base], [1, mix(c.base, c.accent, 0.4)]])
  ctx.fillRect(0, 0, W, H)
  const P = 1.4
  const k = Math.floor(t / P)
  const points: [number, number][] = [[W * 0.66, H * 0.62], [W * 0.88, H * 0.42]]
  blob(ctx, W * 0.8, H * 0.55, Math.max(W, H) * 0.5, c.accent, 0.32)
  for (let i = 0; i < 6; i += 1) {
    const n = k - i
    const age = t - n * P
    const [x, y] = points[((n % 2) + 2) % 2]
    const r = H * (0.03 + age * 0.22)
    const fade = Math.max(0, 1 - age / (P * 6))
    const rings: [number, number, RGB][] = [
      [H * 0.07, 0.22, c.accent],
      [H * 0.02, 0.95, c.accent],
      [H * 0.008, 0.7, c.deep],
      [H * 0.004, 0.9, c.light],
    ]
    for (const [w, a, col] of rings) {
      ctx.strokeStyle = rgba(col, a * fade * fade)
      ctx.lineWidth = w
      ctx.beginPath()
      ctx.arc(x, y, r, 0, TAU)
      ctx.stroke()
    }
    if (age < 0.8) blob(ctx, x, y, H * (0.1 + age * 0.35), c.accent, 0.9 * (1 - age / 0.8))
  }
  const f = (t - k * P) / P
  const [ax, ay] = points[((k % 2) + 2) % 2]
  const [bx, by] = points[(((k + 1) % 2) + 2) % 2]
  const x = ax + (bx - ax) * f
  const y = ay + (by - ay) * f - H * 0.22 * Math.sin(Math.PI * f)
  blob(ctx, x, y, H * 0.09, c.accent, 0.55)
  blob(ctx, x, y, H * 0.025, c.light, 1)
}

const DRAWERS: Record<DisplayTheme["renderer"], Draw> = {
  liquid_glass: liquidGlassField,
  silk,
  rally_ripples: rallyRipples,
}

/**
 * Where the screen's text sits. "left": name top-left (session, up next), so
 * the visuals live on the right. "centre": one big centred message (free
 * table), so visuals move to the edges and a soft wash sits behind the text.
 */
export type ThemeComposition = "left" | "centre"

export function drawThemeField(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  theme: DisplayTheme,
  composition: ThemeComposition = "left",
) {
  const c = colours(theme.palette)
  const inkLight = theme.ink === "light"
  DRAWERS[theme.renderer](ctx, W, H, t, c, inkLight)
  if (composition === "centre") {
    // A wide, soft wash behind the centred message, in the colour that makes
    // the text pop: depth under white text, light under navy text.
    const wash = inkLight ? c.deep : mix(c.base, WHITE, 0.6)
    ctx.save()
    ctx.translate(W * 0.5, H * 0.44)
    ctx.scale(1.9, 1)
    blob(ctx, 0, 0, H * 0.42, wash, inkLight ? 0.4 : 0.7)
    ctx.restore()
  }
}

/** Glass spheres for Liquid Glass, in container units (fractions of height/width). */
const GLASS_ORBS_LEFT = [
  { d: 0.46, cx: 0.7, cy: 0.52, ax: 0.09, ay: 0.07, fx: 0.013, fy: 0.017, ph: 0 },
  { d: 0.24, cx: 0.52, cy: 0.72, ax: 0.12, ay: 0.06, fx: 0.019, fy: 0.012, ph: 2 },
  { d: 0.15, cx: 0.87, cy: 0.68, ax: 0.04, ay: 0.06, fx: 0.023, fy: 0.021, ph: 4 },
  { d: 0.1, cx: 0.4, cy: 0.52, ax: 0.07, ay: 0.06, fx: 0.017, fy: 0.026, ph: 5.5 },
]

/** Centred layout: spheres frame the message from the corners and edges. */
const GLASS_ORBS_CENTRE = [
  { d: 0.5, cx: 0.97, cy: 0.52, ax: 0.02, ay: 0.06, fx: 0.011, fy: 0.014, ph: 0 },
  { d: 0.34, cx: 0.06, cy: 0.74, ax: 0.03, ay: 0.06, fx: 0.016, fy: 0.012, ph: 2 },
  { d: 0.16, cx: 0.12, cy: 0.18, ax: 0.03, ay: 0.04, fx: 0.022, fy: 0.019, ph: 4 },
  { d: 0.12, cx: 0.9, cy: 0.74, ax: 0.03, ay: 0.04, fx: 0.018, fy: 0.024, ph: 5.5 },
]

/** Number of sphere elements a background should mount. */
export const GLASS_ORB_COUNT = GLASS_ORBS_LEFT.length

/** Centre and diameter of each glass sphere at time t, in pixels. */
export function glassOrbLayout(
  t: number,
  width: number,
  height: number,
  composition: ThemeComposition = "left",
) {
  const orbs = composition === "centre" ? GLASS_ORBS_CENTRE : GLASS_ORBS_LEFT
  return orbs.map((o) => {
    const d = o.d * height * (1 + 0.025 * Math.sin(t * 0.3 + o.ph))
    return {
      d,
      x: (o.cx + o.ax * Math.sin(t * o.fx * TAU + o.ph)) * width,
      y: (o.cy + o.ay * Math.cos(t * o.fy * TAU + o.ph)) * height,
    }
  })
}

/** Field canvas scale: drawn at 1/4 size and scaled up soft. */
export const FIELD_SCALE = 1 / 4

/**
 * Renders one frame of a theme as a PNG at full size (default 4K) for
 * downloading and sharing. Glass spheres are composited in canvas here, since
 * the TV's CSS glass can't be captured.
 */
export async function renderThemeStill(
  theme: DisplayTheme,
  options: { width?: number; height?: number; t?: number } = {},
): Promise<Blob> {
  const width = options.width ?? 3840
  const height = options.height ?? 2160
  const t = options.t ?? 40

  const field = document.createElement("canvas")
  field.width = Math.round(width * FIELD_SCALE)
  field.height = Math.round(height * FIELD_SCALE)
  const fctx = field.getContext("2d")!
  drawThemeField(fctx, field.width, field.height, t, theme)

  const out = document.createElement("canvas")
  out.width = width
  out.height = height
  const ctx = out.getContext("2d")!
  ctx.filter = `blur(${Math.round(height * 0.01)}px)`
  const pad = height * 0.02
  ctx.drawImage(field, -pad, -pad, width + pad * 2, height + pad * 2)
  ctx.filter = "none"

  if (theme.renderer === "liquid_glass") {
    const source = document.createElement("canvas")
    source.width = width
    source.height = height
    source.getContext("2d")!.drawImage(out, 0, 0)
    for (const orb of glassOrbLayout(t, width, height)) {
      const r = orb.d / 2
      ctx.save()
      ctx.beginPath()
      ctx.arc(orb.x, orb.y, r, 0, TAU)
      ctx.clip()
      // Frosted refraction: the field behind, blurred and slightly magnified.
      ctx.filter = `blur(${Math.round(height * 0.026)}px) saturate(1.12) brightness(1.04)`
      ctx.drawImage(source, orb.x - r * 1.08, orb.y - r * 1.08, r * 2.16, r * 2.16, orb.x - r, orb.y - r, r * 2, r * 2)
      ctx.filter = "none"
      const sheen = ctx.createRadialGradient(orb.x - r * 0.4, orb.y - r * 0.56, 0, orb.x, orb.y, r * 1.2)
      sheen.addColorStop(0, "rgba(255,255,255,0.55)")
      sheen.addColorStop(0.42, "rgba(255,255,255,0.08)")
      sheen.addColorStop(0.8, "rgba(255,255,255,0.03)")
      sheen.addColorStop(1, "rgba(255,255,255,0.16)")
      ctx.fillStyle = sheen
      ctx.fillRect(orb.x - r, orb.y - r, r * 2, r * 2)
      ctx.restore()
      ctx.beginPath()
      ctx.arc(orb.x, orb.y, r - 1, 0, TAU)
      ctx.strokeStyle = "rgba(255,255,255,0.55)"
      ctx.lineWidth = Math.max(1.5, height * 0.0018)
      ctx.stroke()
      // Specular crescent.
      ctx.save()
      ctx.translate(orb.x - r * 0.18, orb.y - r * 0.6)
      ctx.rotate(-0.32)
      const spec = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.38)
      spec.addColorStop(0, "rgba(255,255,255,0.7)")
      spec.addColorStop(1, "rgba(255,255,255,0)")
      ctx.fillStyle = spec
      ctx.scale(1, 0.45)
      ctx.beginPath()
      ctx.arc(0, 0, r * 0.38, 0, TAU)
      ctx.fill()
      ctx.restore()
    }
  }

  return new Promise((resolve, reject) =>
    out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not render the image."))), "image/png"),
  )
}
