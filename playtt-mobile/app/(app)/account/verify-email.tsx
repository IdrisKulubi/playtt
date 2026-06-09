import { router, useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"
import { ScrollView, StyleSheet } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AccountScreenHeader } from "@/components/account/account-screen-header"
import { AccountVerifyEmailForm } from "@/components/account/account-verify-email-form"
import {
  PlayTTColors,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { sendVerificationOtp } from "@/lib/auth-api"
import { toast } from "@/lib/toast"
import { fetchCurrentUser } from "@/lib/user-api"

export default function AccountVerifyEmailScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>()
  const [email, setEmail] = useState("")

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
          return
        }
      }

      if (!mounted || !resolvedEmail) {
        return
      }

      setEmail(resolvedEmail)

      const result = await sendVerificationOtp(resolvedEmail)
      if (!result.success && mounted) {
        toast.error(result.message)
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
        {email ? (
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
})
