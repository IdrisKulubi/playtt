import { type Href, router } from "expo-router"
import { useMemo } from "react"
import { useMinimizeOnScroll } from "expo-glass-tabs"
import { StyleSheet } from "react-native"
import Animated from "react-native-reanimated"
import { Bell } from "phosphor-react-native/src/icons/Bell"
import { FileText } from "phosphor-react-native/src/icons/FileText"
import { IdentificationCard } from "phosphor-react-native/src/icons/IdentificationCard"
import { Lifebuoy } from "phosphor-react-native/src/icons/Lifebuoy"
import { Palette } from "phosphor-react-native/src/icons/Palette"
import { Play } from "phosphor-react-native/src/icons/Play"

import { AccountGlassRow } from "@/components/account/account-glass-row"
import { AccountGlassSection } from "@/components/account/account-glass-section"
import { FLOATING_TAB_BAR_CLEARANCE } from "@/constants/navigation-layout"
import { goToWelcome } from "@/lib/auth-navigation"
import { useProductTheme } from "@/hooks/use-product-theme"

export function AccountSettingsPanel() {
  const theme = useProductTheme()
  const iconColor = theme.foreground
  const onScroll = useMinimizeOnScroll()

  const scrollStyles = useMemo(
    () =>
      StyleSheet.create({
        scroll: {
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: FLOATING_TAB_BAR_CLEARANCE,
          gap: 20,
        },
      }),
    [],
  )

  return (
    <Animated.ScrollView
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={scrollStyles.scroll}
      showsVerticalScrollIndicator={false}
    >
      <AccountGlassSection title="Preferences">
        <AccountGlassRow
          title="Notifications"
          subtitle="Reminders and booking updates"
          icon={<Bell size={20} color={iconColor} weight="regular" />}
          onPress={() => router.push("/(app)/account/notifications")}
          accessibilityHint="Choose which alerts PlayTT sends you"
        />
        <AccountGlassRow
          title="Player card"
          subtitle="Community profile and privacy"
          icon={<IdentificationCard size={20} color={iconColor} weight="regular" />}
          onPress={() => router.push("/(app)/account/community-profile")}
          accessibilityHint="Edit what other players see in Community"
          isLast
        />
      </AccountGlassSection>

      <AccountGlassSection title="App">
        <AccountGlassRow
          title="Watch intro"
          subtitle="Replay the welcome walkthrough"
          icon={<Play size={20} color={iconColor} weight="regular" />}
          onPress={() => goToWelcome(true)}
          accessibilityHint="Opens the welcome carousel again"
          isLast={!__DEV__}
        />
        {__DEV__ ? (
          <AccountGlassRow
            title="Design kit"
            subtitle="Redesign components (development only)"
            icon={<Palette size={20} color={iconColor} weight="regular" />}
            // Cast until Expo regenerates typed routes on the next dev-server start.
            onPress={() => router.push("/(app)/kit-demo" as Href)}
            accessibilityHint="Opens the component kit demo"
            isLast
          />
        ) : null}
      </AccountGlassSection>

      <AccountGlassSection title="Support">
        <AccountGlassRow
          title="Help"
          subtitle="FAQs and support"
          icon={<Lifebuoy size={20} color={iconColor} weight="regular" />}
          onPress={() => router.push("/(app)/account/help")}
          accessibilityHint="Booking, access, clips, and Coach FAQs"
        />
        <AccountGlassRow
          title="Legal"
          subtitle="Terms and privacy"
          icon={<FileText size={20} color={iconColor} weight="regular" />}
          onPress={() => router.push("/(app)/account/legal")}
          accessibilityHint="Terms of service and privacy policy"
          isLast
        />
      </AccountGlassSection>
    </Animated.ScrollView>
  )
}
