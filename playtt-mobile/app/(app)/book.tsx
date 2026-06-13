import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"

import { BookingFlow } from "@/components/booking/booking-flow"
import { ScreenBackButton } from "@/components/navigation/screen-back-button"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

export default function BookScreen() {
  const theme = useProductTheme()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.background,
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: PlayTTSpacing.lg,
          paddingTop: PlayTTSpacing.sm,
          paddingBottom: PlayTTSpacing.xs,
        },
        title: {
          fontSize: 16,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        spacer: {
          width: 40,
        },
      }),
    [theme],
  )

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar style={theme.statusBar} />
      <View style={styles.header}>
        <ScreenBackButton />
        <Text style={styles.title}>Book a session</Text>
        <View style={styles.spacer} />
      </View>
      <BookingFlow />
    </SafeAreaView>
  )
}
