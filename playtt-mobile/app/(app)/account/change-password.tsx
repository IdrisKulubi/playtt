import { router } from "expo-router"
import { ScrollView, StyleSheet, Text } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AccountScreenHeader } from "@/components/account/account-screen-header"
import { ChangePasswordForm } from "@/components/account/change-password-form"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"

export default function ChangePasswordScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <AccountScreenHeader title="Change password" />

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.description}>
          Enter your current password, then choose a new one with at least 8
          characters.
        </Text>
        <ChangePasswordForm onSaved={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PlayTTColors.background,
  },
  scroll: {
    paddingHorizontal: PlayTTSpacing.xl,
    paddingBottom: PlayTTSpacing["2xl"],
    gap: PlayTTSpacing.md,
  },
  description: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.mutedText,
    lineHeight: 20,
  },
})
