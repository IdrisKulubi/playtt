// The table tablet's permanent background: brand cyan with a few simple 3D
// geometric shapes in the PlayTT colours. Still, so it costs nothing to run.

/** Header ink and logo on the cyan background. The logo is all white so the
 * mark's cyan doesn't vanish into the field. */
export const TABLET_INK = {
  ink: "#ffffff",
  logo: "/brand/playtt-logo-reversed.svg",
  logoFilter: "brightness(0) invert(1)",
} as const

const BRAND = {
  navy: ["#21405e", "#0b2a45", "#041019"],
  coral: ["#ffb39f", "#ff866b", "#d9573a"],
  cream: ["#ffffff", "#fff5da", "#ead9b0"],
} as const
type Shade = keyof typeof BRAND

/** An isometric cube: light top, mid left, dark right. */
function Cube({ x, y, s, shade }: { x: number; y: number; s: number; shade: Shade }) {
  const [light, mid, dark] = BRAND[shade]
  const w = s * 0.866
  return (
    <g transform={`translate(${x} ${y})`}>
      <polygon points={`0,${-s} ${w},${-s / 2} 0,0 ${-w},${-s / 2}`} fill={light} />
      <polygon points={`${-w},${-s / 2} 0,0 0,${s} ${-w},${s / 2}`} fill={mid} />
      <polygon points={`0,0 ${w},${-s / 2} ${w},${s / 2} 0,${s}`} fill={dark} />
    </g>
  )
}

/** A triangular prism standing on its base: lit front, shaded side. */
function Prism({ x, y, s, shade, depth = 0.45 }: { x: number; y: number; s: number; shade: Shade; depth?: number }) {
  const [light, , dark] = BRAND[shade]
  const h = s * 0.9
  const d = s * depth
  return (
    <g transform={`translate(${x} ${y})`}>
      <polygon points={`0,${-h} ${s / 2},0 ${s / 2 + d},${-d * 0.5} ${d},${-h - d * 0.5}`} fill={dark} />
      <polygon points={`${-s / 2},0 ${s / 2},0 0,${-h}`} fill={light} />
    </g>
  )
}

/** A flat slab: a long bar with a lit face and a thick shaded edge. */
function Slab({ x, y, w, h, angle, shade }: { x: number; y: number; w: number; h: number; angle: number; shade: Shade }) {
  const [light, , dark] = BRAND[shade]
  const edge = h * 0.35
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <rect x={-w / 2} y={-h / 2 + edge} width={w} height={h} rx={h * 0.12} fill={dark} />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h * 0.12} fill={light} />
    </g>
  )
}

export function TabletBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 750" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="tb-cyan" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2ec4ff" />
            <stop offset="1" stopColor="#0096e8" />
          </linearGradient>
          <filter id="tb-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#003a7a" floodOpacity="0.28" />
          </filter>
        </defs>
        <rect width="1000" height="750" fill="url(#tb-cyan)" />
        <g filter="url(#tb-shadow)">
          <Cube x={70} y={640} s={120} shade="navy" />
          <Prism x={930} y={720} s={190} shade="coral" />
          <Slab x={935} y={360} w={220} h={44} angle={-28} shade="cream" />
          <Cube x={70} y={330} s={40} shade="cream" />
          <Prism x={560} y={735} s={70} shade="cream" depth={0.4} />
        </g>
      </svg>
    </div>
  )
}
