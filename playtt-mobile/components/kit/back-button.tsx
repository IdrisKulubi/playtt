import { router, type Href } from "expo-router"
import { StyleSheet } from "react-native"

import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

type BackButtonProps = {
  /** Names where back goes ("Messages"); "Back" when it can be several places. */
  label: string
  /** Where to go when there's no screen to pop back to (deep links). */
  fallbackHref: Href
}

/** "‹ Label" in cyan, like iOS: always says where it goes, never just an arrow. */
export function BackButton({ label, fallbackHref }: BackButtonProps) {
  const { colors } = useAppTheme()

  return (
    <PressableScale
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallbackHref))}
      accessibilityLabel={label === "Back" ? "Back" : `Back to ${label}`}
      style={styles.back}
      hitSlop={8}
    >
      <IconSymbol name="chevron.left" size={22} color={colors.accentText} />
      <AppText variant="body" color="accentText" numberOfLines={1}>
        {label}
      </AppText>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  back: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginLeft: -PlayTTSpacing.xs,
    minHeight: 44,
  },
})
