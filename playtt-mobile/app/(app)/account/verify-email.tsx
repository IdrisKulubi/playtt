import { router, useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AccountScreenHeader } from "@/components/account/account-screen-header"
import { AccountVerifyEmailForm } from "@/components/account/account-verify-email-form"
import { AuthFormSkeleton } from "@/components/ui/skeleton"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { sendVerificationOtp } from "@/lib/auth-api"
import { toast } from "@/lib/toast"
import { fetchCurrentUser } from "@/lib/user-api"

export default function AccountVerifyEmailScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>()
  const [email, setEmail] = useState("")
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      let resolvedEmail = typeof emailParam === "string" ? emailParam : ""

      if (!resolvedEmail) {
        try {
          const response = await fetchCurrentUser()
          resolvedEmail = response.data?.user?.email ?? ""
        } catch (error) {
          toast.apiError(error, "Could not start email verification.")
          if (mounted) {
            setIsBootstrapping(false)
          }
          return
        }
      }

      if (!mounted || !resolvedEmail) {
        if (mounted) {
          setIsBootstrapping(false)
        }
        return
      }

      setEmail(resolvedEmail)

      const result = await sendVerificationOtp(resolvedEmail)
      if (!result.success && mounted) {
        toast.error(result.message)
      }

      if (mounted) {
        setIsBootstrapping(false)
      }
    }

    void bootstrap()

    return () => {
      mounted = false
    }
  }, [emailParam])

  return (
    <SafeAreaView style={styles.safeArea}>
      <AccountScreenHeader title="Verify email" />

      <ScrollView contentContainerStyle={styles.scroll}>
        {isBootstrapping ? (
          <View style={styles.bootstrapping}>
            <Text style={styles.bootstrappingText}>Sending code…</Text>
            <AuthFormSkeleton surface="dark" />
          </View>
        ) : email ? (
          <AccountVerifyEmailForm
            email={email}
            onVerified={() => router.back()}
          />
        ) : null}
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
  },
  bootstrapping: {
    gap: PlayTTSpacing.md,
  },
  bootstrappingText: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.mutedText,
  },
})
