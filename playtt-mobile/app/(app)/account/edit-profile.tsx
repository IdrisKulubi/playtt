import { router } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { ScrollView, Text } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AccountScreenHeader } from "@/components/account/account-screen-header"
import { ProfileEditForm } from "@/components/account/profile-edit-form"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { AuthFormSkeleton } from "@/components/ui/skeleton"
import type { SkillLevel } from "@/lib/onboarding-options"
import { toast } from "@/lib/toast"
import { fetchCurrentUser } from "@/lib/user-api"
import {
  useProductTheme,
  useSkeletonSurface,
} from "@/hooks/use-product-theme"

export default function EditProfileScreen() {
  const theme = useProductTheme()
  const skeletonSurface = useSkeletonSurface()
  const styles = useMemo(() => createAppScreenStyles(theme), [theme])

  const [isLoading, setIsLoading] = useState(true)
  const [initialName, setInitialName] = useState("")
  const [initialPhone, setInitialPhone] = useState("")
  const [initialSkillLevel, setInitialSkillLevel] = useState<SkillLevel | null>(
    null,
  )

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const response = await fetchCurrentUser()
        const user = response.data?.user

        if (!mounted || !user) {
          return
        }

        setInitialName(user.name)
        setInitialPhone(user.phone ?? "")
        setInitialSkillLevel((user.skillLevel as SkillLevel | null) ?? null)
      } catch (error) {
        toast.apiError(error, "Could not load your profile.")
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [])

  return (
    <SafeAreaView style={styles.safeArea}>
      <AccountScreenHeader title="Personal details" />

      {isLoading ? (
        <AuthFormSkeleton surface={skeletonSurface} />
      ) : (
        <ScrollView contentContainerStyle={styles.stackScroll}>
          <Text style={styles.stackDescription}>
            Keep your name, skill level, and phone up to date for bookings.
          </Text>
          <ProfileEditForm
            initialName={initialName}
            initialPhone={initialPhone}
            initialSkillLevel={initialSkillLevel}
            onSaved={() => router.back()}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
