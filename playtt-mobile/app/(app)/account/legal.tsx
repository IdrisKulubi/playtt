import { useMemo } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AccountScreenHeader } from "@/components/account/account-screen-header"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

export default function LegalScreen() {
  const theme = useProductTheme()
  const screenStyles = useMemo(() => createAppScreenStyles(theme), [theme])
  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          gap: PlayTTSpacing.sm,
          marginBottom: PlayTTSpacing.lg,
        },
        heading: {
          fontSize: 16,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        body: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 20,
        },
      }),
    [theme],
  )

  return (
    <SafeAreaView style={screenStyles.safeArea}>
      <AccountScreenHeader title="Legal" />
      <ScrollView contentContainerStyle={screenStyles.scroll}>
        <View style={styles.section}>
          <Text style={styles.heading}>Terms of service</Text>
          <Text style={styles.body}>
            Full terms will be published at theplaytt.com/terms. By using
            PlayTT you agree to book in good faith and arrive on time for paid
            sessions.
          </Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.heading}>Privacy policy</Text>
          <Text style={styles.body}>
            Full privacy details will be published at theplaytt.com/privacy. We
            use your contact details for bookings and account security only.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
