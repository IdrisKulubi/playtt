import { useLocalSearchParams } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useState } from "react"
import { StyleSheet } from "react-native"
import { useReducedMotion } from "react-native-reanimated"

import { Button } from "@/components/kit/button"
import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { WelcomeCarousel } from "@/components/welcome/welcome-carousel"
import { WelcomeDots } from "@/components/welcome/welcome-dots"
import { WelcomeShell } from "@/components/welcome/welcome-shell"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { ForceColorScheme } from "@/hooks/use-app-theme"
import { completeWelcomeSignIn, completeWelcomeSignUp } from "@/lib/auth-navigation"

/** First impression: the venue, three plain sentences, and two clear ways in. */
export default function WelcomeScreen() {
  const { replay } = useLocalSearchParams<{ replay?: string }>()
  const isReplay = replay === "1"
  const [activeIndex, setActiveIndex] = useState(0)
  const reduceMotion = useReducedMotion()

  return (
    // Always dark: the text sits on the venue photo's dark wash.
    <ForceColorScheme value="dark">
      <StatusBar style="light" />
      <WelcomeShell
        header={
          <PressableScale
            onPress={() => void completeWelcomeSignIn(isReplay)}
            accessibilityLabel="Skip the intro"
            style={styles.skip}
            hitSlop={8}
          >
            <AppText variant="body" weight="600">
              Skip
            </AppText>
          </PressableScale>
        }
        footer={
          <>
            <WelcomeDots activeIndex={activeIndex} animate={!reduceMotion} />
            <Button label="Get started" onPress={() => void completeWelcomeSignUp(isReplay)} />
            <Button
              label="I already have an account"
              variant="secondary"
              onPress={() => void completeWelcomeSignIn(isReplay)}
            />
          </>
        }
      >
        <WelcomeCarousel onIndexChange={setActiveIndex} />
      </WelcomeShell>
    </ForceColorScheme>
  )
}

const styles = StyleSheet.create({
  skip: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: PlayTTSpacing.md,
  },
})
