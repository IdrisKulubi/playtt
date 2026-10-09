import { router } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { Text, View } from "react-native"

import { AccountGlassSection } from "@/components/account/account-glass-section"
import { AccountStackScreen } from "@/components/account/account-stack-screen"
import { ProfileEditForm } from "@/components/account/profile-edit-form"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { Button } from "@/components/ui/button"
import { AuthFormSkeleton } from "@/components/ui/skeleton"
import type { SkillLevel } from "@/lib/onboarding-options"
import { toast } from "@/lib/toast"
import { fetchCurrentUser } from "@/lib/user-api"
import { useProductTheme, useSkeletonSurface } from "@/hooks/use-product-theme"

export default function EditProfileScreen() {
  const theme = useProductTheme()
  const skeletonSurface = useSkeletonSurface()
  const screenStyles = createAppScreenStyles(theme)

  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [initialName, setInitialName] = useState("")
  const [initialPhone, setInitialPhone] = useState("")
  const [initialSkillLevel, setInitialSkillLevel] = useState<SkillLevel | null>(
    null,
  )

  const load = useCallback(async () => {
    setLoadFailed(false)
    setIsLoading(true)

    try {
      const response = await fetchCurrentUser()
      const user = response.data?.user

      if (!user) {
        setLoadFailed(true)
        return
      }

      setInitialName(user.name)
      setInitialPhone(user.phone ?? "")
      setInitialSkillLevel((user.skillLevel as SkillLevel | null) ?? null)
    } catch (error) {
      toast.apiError(error, "Could not load your profile.")
      setLoadFailed(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function run() {
      try {
        const response = await fetchCurrentUser()
        const user = response.data?.user

        if (!mounted) {
          return
        }

        if (!user) {
          setLoadFailed(true)
          return
        }

        setInitialName(user.name)
        setInitialPhone(user.phone ?? "")
        setInitialSkillLevel((user.skillLevel as SkillLevel | null) ?? null)
      } catch (error) {
        if (!mounted) {
          return
        }
        toast.apiError(error, "Could not load your profile.")
        setLoadFailed(true)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void run()

    return () => {
      mounted = false
    }
  }, [])

  return (
    <AccountStackScreen
      title="Personal details"
      description="Keep your name, skill level, and phone up to date for bookings."
    >
      {isLoading ? (
        <AuthFormSkeleton surface={skeletonSurface} />
      ) : loadFailed ? (
        <View style={screenStyles.empty}>
          <Text style={screenStyles.stackDescription}>
            Could not load your profile.
          </Text>
          <Button
            label="Try again"
            surface="product"
            productTheme={theme}
            onPress={() => void load()}
          />
        </View>
      ) : (
        <AccountGlassSection>
          <ProfileEditForm
            initialName={initialName}
            initialPhone={initialPhone}
            initialSkillLevel={initialSkillLevel}
            onSaved={() => router.back()}
          />
        </AccountGlassSection>
      )}
    </AccountStackScreen>
  )
}
