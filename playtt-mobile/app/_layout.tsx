import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts,
} from "@expo-google-fonts/space-grotesk"
import { DarkTheme, ThemeProvider } from "@react-navigation/native"
import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import * as WebBrowser from "expo-web-browser"
import { useEffect } from "react"
import "react-native-reanimated"

import { PlayTTColors } from "@/constants/playtt-tokens"
import { SessionBootstrap } from "@/components/session-bootstrap"

SplashScreen.preventAutoHideAsync()
WebBrowser.maybeCompleteAuthSession()

const playttDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: PlayTTColors.primary,
    background: PlayTTColors.background,
    card: PlayTTColors.card,
    text: PlayTTColors.foreground,
    border: PlayTTColors.border,
  },
}

export const unstable_settings = {
  anchor: "index",
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  })

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded, fontError])

  if (!fontsLoaded && !fontError) {
    return null
  }

  return (
    <ThemeProvider value={playttDarkTheme}>
      <SessionBootstrap />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: PlayTTColors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="verify-email" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="book" />
        <Stack.Screen name="(app)" />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  )
}
