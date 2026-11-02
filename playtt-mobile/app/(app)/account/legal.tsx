import { StyleSheet, View } from "react-native"

import { AccountStackScreen } from "@/components/account/account-stack-screen"
import { Card } from "@/components/kit/card"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"

const SECTIONS = [
  {
    heading: "Terms of service",
    body:
      "Full terms will be published at theplaytt.com/terms. By using PlayTT you agree to book in good faith and arrive on time for paid sessions.",
  },
  {
    heading: "Privacy policy",
    body:
      "Full privacy details will be published at theplaytt.com/privacy. We use your contact details for bookings and account security only.",
  },
]

export default function LegalScreen() {
  return (
    <AccountStackScreen title="Terms and privacy" description="Terms and privacy for your PlayTT account.">
      {SECTIONS.map((section) => (
        <Card key={section.heading}>
          <View style={styles.card}>
            <AppText variant="headline" accessibilityRole="header">
              {section.heading}
            </AppText>
            <AppText variant="body" color="secondaryLabel">
              {section.body}
            </AppText>
          </View>
        </Card>
      ))}
    </AccountStackScreen>
  )
}

const styles = StyleSheet.create({
  card: { gap: PlayTTSpacing.xs },
})
