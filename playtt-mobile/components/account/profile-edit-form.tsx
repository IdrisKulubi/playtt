import { useState } from "react"
import { StyleSheet, View } from "react-native"

import { AccountFormTheme } from "@/components/account/account-form-theme"
import { OptionChips } from "@/components/onboarding/option-chips"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import {
  SKILL_LEVEL_OPTIONS,
  type SkillLevel,
} from "@/lib/onboarding-options"
import { toast } from "@/lib/toast"
import { patchProfile } from "@/lib/user-api"

type ProfileEditFormProps = {
  initialName: string
  initialPhone: string
  initialSkillLevel: SkillLevel | null
  onSaved: () => void
}

const theme = AccountFormTheme
const fieldProps = { variant: "auth" as const, authTheme: theme, compact: true }
const inputProps = { variant: "auth" as const, authTheme: theme }

export function ProfileEditForm({
  initialName,
  initialPhone,
  initialSkillLevel,
  onSaved,
}: ProfileEditFormProps) {
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(
    initialSkillLevel,
  )
  const [isLoading, setIsLoading] = useState(false)

  async function handleSave() {
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
      await patchProfile({
        name: name.trim(),
        skillLevel,
        phone: phone.trim(),
      })
      toast.success("Profile updated.")
      onSaved()
    } catch (error) {
      toast.apiError(error, "Could not save your profile.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <View style={styles.form}>
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
        label="Save changes"
        surface="auth"
        authTheme={theme}
        onPress={handleSave}
        loading={isLoading}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  form: {
    gap: PlayTTSpacing.md,
  },
})
