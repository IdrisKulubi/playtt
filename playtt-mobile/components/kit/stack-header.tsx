import { router, type Href } from "expo-router"
import { StyleSheet, View } from "react-native"

import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

type StackHeaderProps = {
  title: string
  /** Names where back goes, e.g. "Progress". */
  backLabel: string
  /** Where to go when there's no screen to pop back to (deep links). */
  fallbackHref: Href
}

/**
 * Back button plus large title for pushed screens that own their scroll view
 * (and so can't use `<Screen>`). Place it inside the screen's scroll content.
 */
export function StackHeader({ title, backLabel, fallbackHref }: StackHeaderProps) {
  const { colors } = useAppTheme()

  return (
    <View style={styles.root}>
      <PressableScale
        onPress={() => (router.canGoBack() ? router.back() : router.replace(fallbackHref))}
        accessibilityLabel={`Back to ${backLabel}`}
        style={styles.back}
        hitSlop={8}
      >
        <IconSymbol name="chevron.left" size={22} color={colors.accentText} />
        <AppText variant="body" color="accentText">
          {backLabel}
        </AppText>
      </PressableScale>
      <AppText variant="largeTitle" accessibilityRole="header">
        {title}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: PlayTTSpacing["2xs"], paddingHorizontal: KitLayout.screenGutter },
  back: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginLeft: -PlayTTSpacing.xs,
    minHeight: 44,
  },
})
