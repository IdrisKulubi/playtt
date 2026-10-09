import { router, useLocalSearchParams } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { Text, View } from "react-native"

import { AccountGlassSection } from "@/components/account/account-glass-section"
import { AccountStackScreen } from "@/components/account/account-stack-screen"
import { AccountVerifyEmailForm } from "@/components/account/account-verify-email-form"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { Button } from "@/components/ui/button"
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
  const styles = createAppScreenStyles(theme)

  const { email: emailParam } = useLocalSearchParams<{ email?: string }>()
  const [email, setEmail] = useState("")
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)

  const bootstrap = useCallback(async () => {
    setBootstrapError(null)
    setIsBootstrapping(true)

    let resolvedEmail = typeof emailParam === "string" ? emailParam : ""

    if (!resolvedEmail) {
      try {
        const response = await fetchCurrentUser()
        resolvedEmail = response.data?.user?.email ?? ""
      } catch (error) {
        toast.apiError(error, "Could not start email verification.")
        setBootstrapError("Could not load your email address.")
        setIsBootstrapping(false)
        return
      }
    }

    if (!resolvedEmail) {
      setBootstrapError("No email address is on file for this account.")
      setIsBootstrapping(false)
      return
    }

    setEmail(resolvedEmail)

    const result = await sendVerificationOtp(resolvedEmail)
    if (!result.success) {
      setBootstrapError(result.message)
      setIsBootstrapping(false)
      return
    }

    setIsBootstrapping(false)
  }, [emailParam])

  useEffect(() => {
    let mounted = true

    async function run() {
      let resolvedEmail = typeof emailParam === "string" ? emailParam : ""

      if (!resolvedEmail) {
        try {
          const response = await fetchCurrentUser()
          resolvedEmail = response.data?.user?.email ?? ""
        } catch (error) {
          if (!mounted) {
            return
          }
          toast.apiError(error, "Could not start email verification.")
          setBootstrapError("Could not load your email address.")
          setIsBootstrapping(false)
          return
        }
      }

      if (!mounted) {
        return
      }

      if (!resolvedEmail) {
        setBootstrapError("No email address is on file for this account.")
        setIsBootstrapping(false)
        return
      }

      setEmail(resolvedEmail)

      const result = await sendVerificationOtp(resolvedEmail)
      if (!mounted) {
        return
      }

      if (!result.success) {
        setBootstrapError(result.message)
      }

      setIsBootstrapping(false)
    }

    void run()

    return () => {
      mounted = false
    }
  }, [emailParam])

  const description =
    email && !isBootstrapping && !bootstrapError
      ? `We sent a 6-digit code to ${email}. Enter it below.`
      : undefined

  return (
    <AccountStackScreen title="Verify email" description={description}>
      {isBootstrapping ? (
        <View style={styles.empty}>
          <Text style={styles.stackDescription}>Sending code…</Text>
          <AuthFormSkeleton surface={skeletonSurface} />
        </View>
      ) : bootstrapError ? (
        <View style={styles.empty}>
          <Text style={styles.stackDescription}>{bootstrapError}</Text>
          <Button
            label="Try again"
            surface="product"
            productTheme={theme}
            onPress={() => void bootstrap()}
          />
        </View>
      ) : email ? (
        <AccountGlassSection>
          <AccountVerifyEmailForm
            email={email}
            onVerified={() => router.back()}
          />
        </AccountGlassSection>
      ) : null}
    </AccountStackScreen>
  )
}
