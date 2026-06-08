import { router } from "expo-router"
import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"

import { BrandMark } from "@/components/brand/brand-mark"
import { MarketingShell } from "@/components/layout/marketing-shell"
import { Button } from "@/components/ui/button"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"
import { apiFetch } from "@/lib/api-client"
import { getStoredAuth } from "@/lib/auth-helpers"
import { AUTHENTICATED_HOME } from "@/lib/auth-navigation"
import {
  getCachedSessionRoute,
  setCachedSessionRoute,
} from "@/lib/session-cache"

type CurrentUserResponse = {
  data?: {
    user?: {
      id: string
      email: string
    }
    route?: string
  }
}

export default function LandingScreen() {
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    let mounted = true

    async function bootstrapSession() {
      const storedAuth = await getStoredAuth()

      if (!storedAuth?.token) {
        if (mounted) {
          setIsCheckingSession(false)
        }
        return
      }

      const cachedRoute = await getCachedSessionRoute()
      const initialRoute = cachedRoute?.route || AUTHENTICATED_HOME

      router.replace(initialRoute as never)

      try {
        const response = await apiFetch<CurrentUserResponse>("/api/user/me")
        const route = response.data?.route || AUTHENTICATED_HOME

        await setCachedSessionRoute({
          userId: response.data?.user?.id || storedAuth.userId,
          route,
        })
      } catch {
        // Keep local auth on network/API failures. The API client clears only
        // explicit invalid-session responses.
      }
    }

    bootstrapSession()

    return () => {
      mounted = false
    }
  }, [])

  if (isCheckingSession) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={PlayTTColors.primary} />
      </View>
    )
  }

  return (
    <MarketingShell
      header={<BrandMark />}
      footer={
        <View style={styles.footer}>
          <Button label="Book now" onPress={() => router.push("/book")} />
          <Button
            label="Create account"
            variant="outline"
            onPress={() => router.push("/auth?mode=sign-up")}
          />
          <View style={styles.signInRow}>
            <Text style={styles.signInPrompt}>Already have an account?</Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push("/auth?mode=sign-in")}
              style={({ pressed }) => [
                styles.signInLink,
                pressed && styles.signInLinkPressed,
              ]}
            >
              {({ pressed }) => (
                <Text
                  style={[
                    styles.signInLinkText,
                    pressed && styles.signInLinkTextPressed,
                  ]}
                >
                  Sign in
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      }
    >
      <View style={styles.hero}>
        <View style={styles.glow} />
        <Text style={styles.headline}>
          Table tennis for all, booked in seconds.
        </Text>
        <Text style={styles.tagline}>Autonomous Table Tennis. Anytime.</Text>
      </View>
    </MarketingShell>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PlayTTColors.background,
  },
  hero: {
    position: "relative",
  },
  glow: {
    position: "absolute",
    top: -24,
    left: -16,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: PlayTTColors.primaryGlow,
    opacity: 0.35,
  },
  headline: {
    ...PlayTTTypography.display,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.foreground,
    maxWidth: 320,
  },
  tagline: {
    ...PlayTTTypography.body,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.mutedText,
    marginTop: PlayTTSpacing.md,
    maxWidth: 280,
  },
  footer: {
    gap: PlayTTSpacing.sm,
  },
  signInRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: PlayTTSpacing.xs,
    paddingTop: PlayTTSpacing.xs,
  },
  signInPrompt: {
    ...PlayTTTypography.label,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.mutedText,
  },
  signInLink: {
    paddingVertical: PlayTTSpacing["2xs"],
    paddingHorizontal: PlayTTSpacing["2xs"],
  },
  signInLinkPressed: {
    opacity: 0.85,
  },
  signInLinkText: {
    ...PlayTTTypography.label,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.foreground,
  },
  signInLinkTextPressed: {
    color: PlayTTColors.primary,
  },
})
