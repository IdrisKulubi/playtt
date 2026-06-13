import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts,
} from "@expo-google-fonts/space-grotesk"
import { ThemeProvider } from "@react-navigation/native"
import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import * as WebBrowser from "expo-web-browser"
import { useMemo } from "react"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import "react-native-reanimated"

import { SessionBootstrap } from "@/components/session-bootstrap"
import { SplashScreenProvider } from "@/components/splash-screen-provider"
import { ToastHost } from "@/components/ui/toast-host"
import {
  Colors,
  getNavigationTheme,
  resolveColorScheme,
} from "@/constants/theme"
import { useColorScheme } from "@/hooks/use-color-scheme"

SplashScreen.preventAutoHideAsync()
WebBrowser.maybeCompleteAuthSession()

export const unstable_settings = {
  anchor: "index",
}

export default function RootLayout() {
  const colorScheme = resolveColorScheme(useColorScheme())
  const navigationTheme = useMemo(
    () => getNavigationTheme(colorScheme),
    [colorScheme],
  )
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  })

  const fontsReady = fontsLoaded || Boolean(fontError)

  if (!fontsReady) {
    return null
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SplashScreenProvider fontsReady={fontsReady}>
        <ThemeProvider value={navigationTheme}>
          <SessionBootstrap />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: {
                backgroundColor: Colors[colorScheme].background,
              },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="welcome" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="sign-up" />
            <Stack.Screen name="verify-email" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="reset-password" />
            <Stack.Screen name="book" />
            <Stack.Screen name="(app)" />
          </Stack>
          <ToastHost />
          <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
        </ThemeProvider>
      </SplashScreenProvider>
    </GestureHandlerRootView>
  )
}
