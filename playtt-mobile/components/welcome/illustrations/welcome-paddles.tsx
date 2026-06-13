import Svg, { Circle, Path, Rect } from "react-native-svg"

import { PlayTTColors } from "@/constants/playtt-tokens"

type WelcomePaddlesProps = {
  size?: number
}

export function WelcomePaddles({ size = 160 }: WelcomePaddlesProps) {
  const center = size / 2

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle
        cx={center}
        cy={center}
        r={68}
        fill={PlayTTColors.primary}
        opacity={0.15}
      />
      <Circle cx={center} cy={center} r={68} fill="none" stroke={PlayTTColors.border} strokeWidth={1.5} />
      <Path
        d={`M ${center - 38} ${center + 20} L ${center - 12} ${center - 28} Q ${center - 8} ${center - 36} ${center} ${center - 38} Q ${center + 8} ${center - 36} ${center + 4} ${center - 28} L ${center - 22} ${center + 20} Z`}
        fill={PlayTTColors.primary}
      />
      <Rect
        x={center - 28}
        y={center + 18}
        width={12}
        height={28}
        rx={3}
        fill={PlayTTColors.backgroundElevated}
      />
      <Path
        d={`M ${center + 38} ${center + 20} L ${center + 12} ${center - 28} Q ${center + 8} ${center - 36} ${center} ${center - 38} Q ${center - 8} ${center - 36} ${center - 4} ${center - 28} L ${center + 22} ${center + 20} Z`}
        fill={PlayTTColors.mutedText}
        opacity={0.7}
      />
      <Rect
        x={center + 16}
        y={center + 18}
        width={12}
        height={28}
        rx={3}
        fill={PlayTTColors.backgroundElevated}
      />
    </Svg>
  )
}
