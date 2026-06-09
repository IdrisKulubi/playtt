import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { OptionChips } from "@/components/onboarding/option-chips"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAuthTheme } from "@/hooks/use-auth-theme"
import { toast } from "@/lib/toast"
import {
  SKILL_LEVEL_OPTIONS,
  type SkillLevel,
} from "@/lib/onboarding-options"
import { patchOnboarding } from "@/lib/user-api"

type OnboardingProfileFormProps = {
  initialName: string
  onComplete: () => void
}

export function OnboardingProfileForm({
  initialName,
  onComplete,
}: OnboardingProfileFormProps) {
  const theme = useAuthTheme()
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState("")
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fieldProps = { variant: "auth" as const, authTheme: theme, compact: true }
  const inputProps = { variant: "auth" as const, authTheme: theme }

  async function handleContinue() {
    if (!name.trim() || name.trim().length < 2) {
      toast.error("Enter your display name.")
      return
    }

    if (!skillLevel) {
      toast.error("Select your skill level.")
      return
    }

    if (!phone.trim()) {
      toast.error("Phone number is required.")
      return
    }

    setIsLoading(true)

    try {
      await patchOnboarding({
        step: 1,
        name: name.trim(),
        skillLevel,
        phone: phone.trim(),
      })
      onComplete()
    } catch (error) {
      toast.apiError(error, "Could not save your profile.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <View style={styles.form}>
      <Text style={[styles.progress, { color: theme.muted }]}>Step 1 of 2</Text>

      <FormField label="Display name" {...fieldProps}>
        <Input
          {...inputProps}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          autoComplete="name"
        />
      </FormField>

      <FormField label="Skill level" {...fieldProps}>
        <OptionChips
          theme={theme}
          options={SKILL_LEVEL_OPTIONS}
          value={skillLevel}
          onChange={(value) => setSkillLevel(value as SkillLevel)}
        />
      </FormField>

      <FormField label="Phone number" {...fieldProps}>
        <Input
          {...inputProps}
          value={phone}
          onChangeText={setPhone}
          placeholder="07XX XXX XXX"
          keyboardType="phone-pad"
          autoComplete="tel"
        />
      </FormField>

      <Button
        label="Continue"
        surface="auth"
        authTheme={theme}
        onPress={handleContinue}
        loading={isLoading}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  form: {
    gap: PlayTTSpacing.md,
  },
  progress: {
    fontSize: 12,
    fontFamily: PlayTTFontFamilies.medium,
    textAlign: "center",
  },
})
