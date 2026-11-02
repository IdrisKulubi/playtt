import type { Href } from "expo-router"
import { StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { CoachHomePanel } from "@/components/coach/coach-home-panel"
import { StackHeader } from "@/components/kit/stack-header"
import { useAppTheme } from "@/hooks/use-app-theme"

const PROGRESS_HREF = "/(app)/(tabs)/activity" as Href

/** Coach as its own screen, opened from Progress (and the Play shortcuts). */
export default function CoachScreen() {
  const { colors } = useAppTheme()

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top", "left", "right"]}>
      <StackHeader title="Coach" backLabel="Back" fallbackHref={PROGRESS_HREF} />
      <View style={styles.body}>
        <CoachHomePanel isActive />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
})
