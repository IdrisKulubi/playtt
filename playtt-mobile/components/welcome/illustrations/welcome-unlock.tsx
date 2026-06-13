import Svg, { Circle, Path, Rect } from "react-native-svg"

import { PlayTTColors } from "@/constants/playtt-tokens"

type WelcomeUnlockProps = {
  size?: number
}

export function WelcomeUnlock({ size = 160 }: WelcomeUnlockProps) {
  const center = size / 2

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle
        cx={center}
        cy={center}
        r={68}
        fill={PlayTTColors.backgroundElevated}
        stroke={PlayTTColors.border}
        strokeWidth={1.5}
      />
      <Rect
        x={center - 28}
        y={center - 40}
        width={56}
        height={96}
        rx={10}
        fill={PlayTTColors.foreground}
      />
      <Rect
        x={center - 22}
        y={center - 32}
        width={44}
        height={72}
        rx={6}
        fill={PlayTTColors.background}
      />
      <Circle cx={center} cy={center + 28} r={4} fill={PlayTTColors.mutedText} />
      <Path
        d={`M ${center - 14} ${center + 4} L ${center - 14} ${center - 6} A 14 14 0 0 1 ${center + 14} ${center - 6} L ${center + 14} ${center + 4}`}
        fill="none"
        stroke={PlayTTColors.primary}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Rect
        x={center - 6}
        y={center + 4}
        width={12}
        height={14}
        rx={2}
        fill={PlayTTColors.primary}
      />
    </Svg>
  )
}
