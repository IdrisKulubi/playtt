import { router } from "expo-router"
import { useMemo } from "react"
import { ScrollView } from "react-native"

import { AccountRow } from "@/components/account/account-row"
import { AccountSection } from "@/components/account/account-section"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { FLOATING_TAB_BAR_CLEARANCE } from "@/constants/navigation-layout"
import { goToWelcome } from "@/lib/auth-navigation"
import { useProductTheme } from "@/hooks/use-product-theme"

export function AccountSettingsPanel() {
  const theme = useProductTheme()
  const styles = useMemo(() => createAppScreenStyles(theme), [theme])

  return (
    <ScrollView
      contentContainerStyle={[
        styles.accountScroll,
        { paddingBottom: FLOATING_TAB_BAR_CLEARANCE },
      ]}
    >
      <AccountSection title="Preferences">
        <AccountRow
          title="Coach"
          subtitle="Subscription and clip packs"
          onPress={() =>
            router.push({
              pathname: "/(app)/(tabs)",
              params: { homeTab: "coach" },
            })
          }
        />
        <AccountRow
          title="Notifications"
          subtitle="Reminders and booking updates"
          onPress={() => router.push("/(app)/account/notifications")}
          isLast
        />
      </AccountSection>

      <AccountSection title="App">
        <AccountRow
          title="Replay intro"
          subtitle="View the welcome walkthrough"
          onPress={() => goToWelcome(true)}
          isLast
        />
      </AccountSection>

      <AccountSection title="Support">
        <AccountRow
          title="Help"
          subtitle="FAQs and support"
          onPress={() => router.push("/(app)/account/help")}
        />
        <AccountRow
          title="Legal"
          subtitle="Terms and privacy"
          onPress={() => router.push("/(app)/account/legal")}
          isLast
        />
      </AccountSection>
    </ScrollView>
  )
}
