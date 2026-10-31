import { useMemo } from "react"
import { StyleSheet } from "react-native"
import Svg, {
  ClipPath,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg"

import type { CardTierTokens } from "./card-tiers"

type CardBackgroundProps = {
  width: number
  height: number
  tokens: CardTierTokens
  radius: number
  /** Depth of the paddle-shaped dip in the top edge; 0 for a plain rectangle. */
  notchDepth: number
  /** Vertical center of the avatar glow, as a fraction of the height. */
  glowY?: number
  /** Solid fill under Reduce Transparency. */
  flat?: boolean
  idPrefix: string
}

/** Rounded rectangle with a smooth paddle-shaped dip centered on the top edge. */
export function cardShapePath(width: number, height: number, radius: number, notchDepth: number) {
  const r = Math.min(radius, width / 2, height / 2)
  const cx = width / 2
  const half = Math.min(width * 0.16, 56)
  const top =
    notchDepth > 0
      ? `H ${cx - half} C ${cx - half / 2} 0 ${cx - half / 2} ${notchDepth} ${cx} ${notchDepth} ` +
        `C ${cx + half / 2} ${notchDepth} ${cx + half / 2} 0 ${cx + half} 0 `
      : ""

  return (
    `M ${r} 0 ${top}H ${width - r} A ${r} ${r} 0 0 1 ${width} ${r} ` +
    `V ${height - r} A ${r} ${r} 0 0 1 ${width - r} ${height} ` +
    `H ${r} A ${r} ${r} 0 0 1 0 ${height - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`
  )
}

export function CardBackground({
  width,
  height,
  tokens,
  radius,
  notchDepth,
  glowY = 0.42,
  flat = false,
  idPrefix,
}: CardBackgroundProps) {
  const shape = useMemo(
    () => cardShapePath(width, height, radius, notchDepth),
    [width, height, radius, notchDepth],
  )

  // Diagonal "net line" texture at 6% opacity.
  const netLines = useMemo(() => {
    const lines: { x1: number; x2: number }[] = []
    for (let x = -height; x < width + height; x += 14) {
      lines.push({ x1: x, x2: x + height })
    }
    return lines
  }, [width, height])

  if (width <= 0 || height <= 0) {
    return null
  }

  const inset = tokens.borderWidth / 2
  const border = cardShapePath(width - inset * 2, height - inset * 2, radius - inset, notchDepth)

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id={`${idPrefix}-base`} x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={tokens.gradient[0]} />
          <Stop offset="1" stopColor={tokens.gradient[1]} />
        </LinearGradient>
        <LinearGradient id={`${idPrefix}-border`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={tokens.accent} stopOpacity={tokens.borderOpacity} />
          <Stop offset="1" stopColor={tokens.borderEnd} stopOpacity={tokens.borderOpacity} />
        </LinearGradient>
        <RadialGradient id={`${idPrefix}-glow`} cx="50%" cy={`${glowY * 100}%`} r="45%">
          <Stop offset="0" stopColor={tokens.accent} stopOpacity={0.32} />
          <Stop offset="1" stopColor={tokens.accent} stopOpacity={0} />
        </RadialGradient>
        <ClipPath id={`${idPrefix}-clip`}>
          <Path d={shape} />
        </ClipPath>
      </Defs>

      <Path d={shape} fill={flat ? tokens.gradient[1] : `url(#${idPrefix}-base)`} />

      {!flat ? (
        <G clipPath={`url(#${idPrefix}-clip)`}>
          <Rect x={0} y={0} width={width} height={height} fill={`url(#${idPrefix}-glow)`} />
          {netLines.map((line) => (
            <Line
              key={line.x1}
              x1={line.x1}
              y1={0}
              x2={line.x2}
              y2={height}
              stroke={tokens.text}
              strokeOpacity={0.06}
              strokeWidth={1}
            />
          ))}
        </G>
      ) : null}

      <Path
        d={border}
        transform={`translate(${inset} ${inset})`}
        fill="none"
        stroke={`url(#${idPrefix}-border)`}
        strokeWidth={tokens.borderWidth}
      />
    </Svg>
  )
}
