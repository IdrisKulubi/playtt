import { StyleSheet, View } from "react-native"

import { AccountStackScreen } from "@/components/account/account-stack-screen"
import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { openWebPage } from "@/lib/open-web-page"
import { PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from "@/lib/release-flags"

const SECTIONS = [
  {
    heading: "Terms of service",
    body: "The rules for booking and playing at PlayTT: book in good faith, arrive on time, look after the pods and be kind to other players.",
    label: "Read the terms",
    url: TERMS_URL,
  },
  {
    heading: "Privacy policy",
    body: "What PlayTT collects, why, who sees it, how long we keep it, and how to delete your account.",
    label: "Read the privacy policy",
    url: PRIVACY_URL,
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
            <Button label={section.label} variant="secondary" onPress={() => void openWebPage(section.url)} />
          </View>
        </Card>
      ))}
      <AppText variant="footnote" color="secondaryLabel">
        Questions about your data? Email {SUPPORT_EMAIL}.
      </AppText>
    </AccountStackScreen>
  )
}

const styles = StyleSheet.create({
  card: { gap: PlayTTSpacing.sm },
})
