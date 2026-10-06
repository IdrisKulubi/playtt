import { Image } from "expo-image"
import { StyleSheet, View } from "react-native"

import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useColorScheme } from "@/hooks/use-color-scheme"

const LOGO_ASPECT = 2070 / 600

type BrandMarkProps = {
  size?: "default" | "compact"
  layout?: "horizontal" | "auth"
  appearance?: "light" | "dark"
}

export function BrandMark({
  size = "default",
  layout = "horizontal",
  appearance,
}: BrandMarkProps) {
  const colorScheme = useColorScheme()
  const isCompact = size === "compact"
  const logoWidth = layout === "auth" ? 142 : isCompact ? 140 : 168
  const logoHeight = logoWidth / LOGO_ASPECT
  const logoSource =
    (appearance ?? colorScheme) === "dark"
      ? require("@/assets/images/logo-reversed.png")
      : require("@/assets/images/logo.png")

  return (
    <View style={styles.container} accessibilityRole="header">
      <Image
        source={logoSource}
        style={{ width: logoWidth, height: logoHeight }}
        contentFit="contain"
        accessibilityLabel="PlayTT"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    gap: PlayTTSpacing.sm,
  },
})
