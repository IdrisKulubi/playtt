import { useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { StatusBar } from "expo-status-bar"

import { WelcomeCarousel } from "@/components/welcome/welcome-carousel"
import { WelcomeDots } from "@/components/welcome/welcome-dots"
import { WelcomeShell } from "@/components/welcome/welcome-shell"
import { Button } from "@/components/ui/button"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"
import {
  completeWelcomeSignIn,
  completeWelcomeSignUp,
} from "@/lib/auth-navigation"

export default function WelcomeScreen() {
  const { replay } = useLocalSearchParams<{ replay?: string }>()
  const isReplay = replay === "1"
  const [activeIndex, setActiveIndex] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion)
  }, [])

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <WelcomeShell
        header={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip intro"
            onPress={() => void completeWelcomeSignIn(isReplay)}
            hitSlop={12}
          >
            <Text style={styles.skipLabel}>Skip</Text>
          </Pressable>
        }
        footer={
          <>
            <WelcomeDots
              activeIndex={activeIndex}
              animate={!reduceMotion}
            />
            <Button
              label="Get started"
              surface="marketing"
              onPress={() => void completeWelcomeSignUp(isReplay)}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Already have an account? Sign in"
              onPress={() => void completeWelcomeSignIn(isReplay)}
            >
              <Text style={styles.secondaryLink}>Already have an account?</Text>
            </Pressable>
          </>
        }
      >
        <WelcomeCarousel onIndexChange={setActiveIndex} />
      </WelcomeShell>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PlayTTColors.background,
  },
  skipLabel: {
    ...PlayTTTypography.label,
    fontFamily: PlayTTFontFamilies.medium,
    color: PlayTTColors.mutedText,
    paddingVertical: PlayTTSpacing.xs,
  },
  secondaryLink: {
    ...PlayTTTypography.body,
    fontFamily: PlayTTFontFamilies.medium,
    color: PlayTTColors.foreground,
    textAlign: "center",
    textDecorationLine: "underline",
    paddingVertical: PlayTTSpacing.xs,
  },
})
