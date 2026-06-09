import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { OptionChips } from "@/components/onboarding/option-chips"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAuthTheme } from "@/hooks/use-auth-theme"
import { toast } from "@/lib/toast"
import {
  PLAY_INTENT_OPTIONS,
  REFERRAL_SOURCE_OPTIONS,
  type PlayIntent,
  type ReferralSource,
} from "@/lib/onboarding-options"
import { patchOnboarding, routeAfterAuth } from "@/lib/user-api"

export function OnboardingSurveyForm() {
  const theme = useAuthTheme()
  const [referralSource, setReferralSource] = useState<ReferralSource | null>(
    null,
  )
  const [playIntent, setPlayIntent] = useState<PlayIntent | null>(null)
  const [earlyAdopterOptIn, setEarlyAdopterOptIn] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const fieldProps = { variant: "auth" as const, authTheme: theme, compact: true }

  async function handleFinish() {
    if (!referralSource) {
      toast.error("Tell us how you heard about PlayTT.")
      return
    }

    if (!playIntent) {
      toast.error("Tell us what brings you here.")
      return
    }

    setIsLoading(true)

    try {
      await patchOnboarding({
        step: 2,
        referralSource,
        playIntent,
        earlyAdopterOptIn,
      })
      await routeAfterAuth()
    } catch (error) {
      toast.apiError(error, "Could not finish onboarding.")
      setIsLoading(false)
    }
  }

  return (
    <View style={styles.form}>
      <Text style={[styles.progress, { color: theme.muted }]}>Step 2 of 2</Text>

      <FormField label="How did you hear about PlayTT?" {...fieldProps}>
        <OptionChips
          theme={theme}
          options={REFERRAL_SOURCE_OPTIONS}
          value={referralSource}
          onChange={(value) => setReferralSource(value as ReferralSource)}
        />
      </FormField>

      <FormField label="What brings you here?" {...fieldProps}>
        <OptionChips
          theme={theme}
          options={PLAY_INTENT_OPTIONS}
          value={playIntent}
          onChange={(value) => setPlayIntent(value as PlayIntent)}
        />
      </FormField>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: earlyAdopterOptIn }}
        onPress={() => setEarlyAdopterOptIn((current) => !current)}
        style={styles.optInRow}
      >
        <View
          style={[
            styles.checkbox,
            {
              borderColor: theme.divider,
              backgroundColor: earlyAdopterOptIn ? theme.primary : theme.socialFill,
            },
          ]}
        >
          {earlyAdopterOptIn ? (
            <Text style={[styles.checkmark, { color: theme.primaryForeground }]}>
              ✓
            </Text>
          ) : null}
        </View>
        <Text style={[styles.optInLabel, { color: theme.foreground }]}>
          Keep me in the early feedback loop
        </Text>
      </Pressable>

      <Button
        label="Finish setup"
        surface="auth"
        authTheme={theme}
        onPress={handleFinish}
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
  optInRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: PlayTTSpacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.bold,
    lineHeight: 16,
  },
  optInLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.regular,
    lineHeight: 20,
  },
})
