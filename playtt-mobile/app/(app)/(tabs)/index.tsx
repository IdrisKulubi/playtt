import { router } from "expo-router"
import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { BrandMark } from "@/components/brand/brand-mark"
import { Button } from "@/components/ui/button"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"
import { useSession } from "@/lib/auth-client"
import { clearSession } from "@/lib/auth-helpers"

export default function AppHomeScreen() {
  const { data: session } = useSession()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)
    await clearSession()
    router.replace("/?mode=sign-in")
    setIsSigningOut(false)
  }

  const userEmail = session?.user?.email ?? "Signed in"

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <BrandMark size="compact" />
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.description}>
          You are signed in as {userEmail}. Booking and venue features will land
          here next.
        </Text>
        <Button
          label="Sign out"
          variant="outline"
          surface="product"
          onPress={handleSignOut}
          loading={isSigningOut}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PlayTTColors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: PlayTTSpacing.xl,
    paddingTop: PlayTTSpacing.lg,
    gap: PlayTTSpacing.md,
  },
  title: {
    ...PlayTTTypography.headline,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.foreground,
  },
  description: {
    ...PlayTTTypography.body,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.productMuted,
  },
})
