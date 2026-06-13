import Svg, { Circle, Ellipse } from "react-native-svg"

import { PlayTTColors } from "@/constants/playtt-tokens"

type WelcomeBallProps = {
  size?: number
}

export function WelcomeBall({ size = 160 }: WelcomeBallProps) {
  const center = size / 2

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Ellipse
        cx={center}
        cy={center + 36}
        rx={28}
        ry={8}
        fill="rgba(0, 183, 255, 0.18)"
      />
      <Circle
        cx={center}
        cy={center - 4}
        r={36}
        fill={PlayTTColors.foreground}
      />
      <Circle
        cx={center - 10}
        cy={center - 14}
        r={8}
        fill="rgba(255, 255, 255, 0.35)"
      />
    </Svg>
  )
}
