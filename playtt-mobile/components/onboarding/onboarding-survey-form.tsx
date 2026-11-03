import { useState } from "react"
import { StyleSheet, View } from "react-native"

import { Button } from "@/components/kit/button"
import { RadioList } from "@/components/kit/radio-list"
import { StepHeader } from "@/components/kit/step-header"
import {
  PLAY_INTENT_OPTIONS,
  REFERRAL_SOURCE_OPTIONS,
  type PlayIntent,
  type ReferralSource,
} from "@/lib/onboarding-options"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { toast } from "@/lib/toast"
import { patchOnboarding, routeAfterAuth } from "@/lib/user-api"

type Feedback = "yes" | "no"

const FEEDBACK_OPTIONS = [
  { value: "yes" as const, label: "Yes, ask me what I think" },
  { value: "no" as const, label: "No thanks" },
]

const QUESTIONS = [
  "How did you hear about PlayTT?",
  "What brings you here?",
  "Can we ask for your feedback now and then?",
] as const

/** The profile step plus one step per survey question. */
export const ONBOARDING_STEPS = 1 + QUESTIONS.length

/**
 * Onboarding survey, one question per screen with big answers.
 * Every question can be skipped; unanswered ones are saved as empty.
 */
export function OnboardingSurveyForm() {
  const [question, setQuestion] = useState(0)
  const [referralSource, setReferralSource] = useState<ReferralSource | null>(null)
  const [playIntent, setPlayIntent] = useState<PlayIntent | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const answered = [referralSource, playIntent, feedback][question] !== null
  const isLast = question === QUESTIONS.length - 1

  async function handleFinish() {
    setIsLoading(true)
    try {
      await patchOnboarding({
        step: 2,
        referralSource,
        playIntent,
        earlyAdopterOptIn: feedback === "yes",
      })
      await routeAfterAuth()
    } catch (error) {
      toast.apiError(error, "Could not finish setting up.")
      setIsLoading(false)
    }
  }

  return (
    <View style={styles.form}>
      <StepHeader step={question + 2} total={ONBOARDING_STEPS} title={QUESTIONS[question]} />

      {question === 0 ? (
        <RadioList
          label={QUESTIONS[0]}
          options={REFERRAL_SOURCE_OPTIONS}
          value={referralSource}
          onChange={setReferralSource}
        />
      ) : question === 1 ? (
        <RadioList label={QUESTIONS[1]} options={PLAY_INTENT_OPTIONS} value={playIntent} onChange={setPlayIntent} />
      ) : (
        <RadioList label={QUESTIONS[2]} options={FEEDBACK_OPTIONS} value={feedback} onChange={setFeedback} />
      )}

      <Button
        label={isLast ? "Finish" : "Continue"}
        disabled={!answered}
        accessibilityHint={answered ? undefined : "Choose an answer first"}
        loading={isLoading}
        onPress={() => (isLast ? void handleFinish() : setQuestion((value) => value + 1))}
      />
      {question > 0 ? (
        <Button label="Back" variant="plain" onPress={() => setQuestion((value) => value - 1)} />
      ) : null}
      <Button
        label="Skip these questions"
        variant="plain"
        accessibilityHint="Finishes setup without answering the rest"
        disabled={isLoading}
        onPress={() => void handleFinish()}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: PlayTTSpacing.md },
})
