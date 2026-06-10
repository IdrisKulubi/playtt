import { router } from "expo-router"
import { useMemo } from "react"
import { ScrollView, Text } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AccountScreenHeader } from "@/components/account/account-screen-header"
import { ChangePasswordForm } from "@/components/account/change-password-form"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { useProductTheme } from "@/hooks/use-product-theme"

export default function ChangePasswordScreen() {
  const theme = useProductTheme()
  const styles = useMemo(() => createAppScreenStyles(theme), [theme])

  return (
    <SafeAreaView style={styles.safeArea}>
      <AccountScreenHeader title="Change password" />

      <ScrollView contentContainerStyle={styles.stackScroll}>
        <Text style={styles.stackDescription}>
          Enter your current password, then choose a new one with at least 8
          characters.
        </Text>
        <ChangePasswordForm onSaved={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  )
}
