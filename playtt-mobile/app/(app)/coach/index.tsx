import { router } from "expo-router"
import { StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { CoachHomePanel } from "@/components/coach/coach-home-panel"
import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

/**
 * Coach as its own screen (redesign Phase 2). It moved out of the Play tab's
 * segment control; Phase 3 links it from Progress next to the stats it explains.
 */
export default function CoachScreen() {
  const { colors } = useAppTheme()
  const canGoBack = router.canGoBack()

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <PressableScale
          onPress={() => (canGoBack ? router.back() : router.replace("/(app)/(tabs)"))}
          accessibilityLabel={canGoBack ? "Back" : "Back to Play"}
          style={styles.back}
          hitSlop={8}
        >
          <IconSymbol name="chevron.left" size={22} color={colors.accentText} />
          <AppText variant="body" color="accentText">
            {canGoBack ? "Back" : "Play"}
          </AppText>
        </PressableScale>
        <AppText variant="largeTitle" accessibilityRole="header">
          Coach
        </AppText>
      </View>
      <View style={styles.body}>
        <CoachHomePanel isActive />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: KitLayout.screenGutter,
    gap: PlayTTSpacing["2xs"],
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginLeft: -PlayTTSpacing.xs,
    minHeight: 44,
  },
  body: { flex: 1 },
})
