import { router, useLocalSearchParams } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AccountScreenHeader } from "@/components/account/account-screen-header"
import { AccountVerifyEmailForm } from "@/components/account/account-verify-email-form"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { AuthFormSkeleton } from "@/components/ui/skeleton"
import { sendVerificationOtp } from "@/lib/auth-api"
import { toast } from "@/lib/toast"
import { fetchCurrentUser } from "@/lib/user-api"
import {
  useProductTheme,
  useSkeletonSurface,
} from "@/hooks/use-product-theme"

export default function AccountVerifyEmailScreen() {
  const theme = useProductTheme()
  const skeletonSurface = useSkeletonSurface()
  const styles = useMemo(() => createAppScreenStyles(theme), [theme])

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

      <ScrollView contentContainerStyle={styles.stackScroll}>
        {isBootstrapping ? (
          <View style={styles.empty}>
            <Text style={styles.stackDescription}>Sending code…</Text>
            <AuthFormSkeleton surface={skeletonSurface} />
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
