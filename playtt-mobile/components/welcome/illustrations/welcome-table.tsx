import Svg, { Circle, Line, Rect } from "react-native-svg"

import { PlayTTColors } from "@/constants/playtt-tokens"

type WelcomeTableProps = {
  size?: number
}

export function WelcomeTable({ size = 160 }: WelcomeTableProps) {
  const center = size / 2
  const tableW = 72
  const tableH = 44

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle
        cx={center}
        cy={center}
        r={68}
        fill={PlayTTColors.card}
        stroke={PlayTTColors.border}
        strokeWidth={1.5}
      />
      <Rect
        x={center - tableW / 2}
        y={center - tableH / 2}
        width={tableW}
        height={tableH}
        rx={4}
        fill={PlayTTColors.primary}
        opacity={0.85}
      />
      <Line
        x1={center - tableW / 2 + 6}
        y1={center}
        x2={center + tableW / 2 - 6}
        y2={center}
        stroke={PlayTTColors.foreground}
        strokeWidth={1.5}
        opacity={0.6}
      />
      <Line
        x1={center}
        y1={center - tableH / 2 + 4}
        x2={center}
        y2={center + tableH / 2 - 4}
        stroke={PlayTTColors.foreground}
        strokeWidth={2}
        opacity={0.8}
      />
      <Circle
        cx={center - 22}
        cy={center - 6}
        r={5}
        fill={PlayTTColors.foreground}
      />
    </Svg>
  )
}
