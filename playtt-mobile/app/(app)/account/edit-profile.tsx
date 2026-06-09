import { router } from "expo-router"
import { useEffect, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AccountScreenHeader } from "@/components/account/account-screen-header"
import { ProfileEditForm } from "@/components/account/profile-edit-form"
import { AuthFormSkeleton } from "@/components/ui/skeleton"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import type { SkillLevel } from "@/lib/onboarding-options"
import { toast } from "@/lib/toast"
import { fetchCurrentUser } from "@/lib/user-api"

export default function EditProfileScreen() {
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
        <AuthFormSkeleton surface="dark" />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.description}>
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
