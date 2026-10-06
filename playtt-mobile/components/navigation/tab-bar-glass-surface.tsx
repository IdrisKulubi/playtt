import {
  LiquidGlassSurface,
  liquidGlassFill,
  useNativeLiquidGlass,
} from "@/components/ui/liquid-glass-surface"
import type { AppColorScheme } from "@/constants/theme"
import type { StyleProp, ViewStyle } from "react-native"

type TabBarGlassSurfaceProps = {
  colorScheme: AppColorScheme
  style?: StyleProp<ViewStyle>
}

export function useNativeTabBarGlass() {
  return useNativeLiquidGlass()
}

export function TabBarGlassSurface(props: TabBarGlassSurfaceProps) {
  return <LiquidGlassSurface {...props} />
}

export const tabBarGlassFill = liquidGlassFill
