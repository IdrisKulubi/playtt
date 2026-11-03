import { StyleSheet, View } from "react-native"

import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { AppText } from "@/components/ui/app-text"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { setAiConsent, useAiConsent } from "@/lib/ai-consent"
import { PRIVACY_URL } from "@/lib/release-flags"
import { openWebPage } from "@/lib/open-web-page"

/** Asked once before anything is sent to the AI service, and again if you said no. */
export function AiConsentCard() {
  const consent = useAiConsent()

  return (
    <View style={styles.root}>
      <Card>
        <View style={styles.body}>
          <AppText variant="title3" accessibilityRole="header">
            Before you chat with Coach
          </AppText>
          <AppText variant="body" color="secondaryLabel">
            Coach is powered by a third-party AI service. If you allow it, the messages you type and the play stats needed to
            answer them are sent to that service to write a reply.
          </AppText>
          <AppText variant="body" color="secondaryLabel">
            We never send your payment details, phone number, email or password. You can change your mind at any time.
          </AppText>
          <Button label="Allow" onPress={() => void setAiConsent("granted")} />
          <Button
            label={consent === "denied" ? "Not now (saved)" : "Not now"}
            variant="secondary"
            onPress={() => void setAiConsent("denied")}
          />
          <Button label="Read the privacy policy" variant="plain" onPress={() => void openWebPage(PRIVACY_URL)} />
        </View>
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: KitLayout.screenGutter, paddingTop: PlayTTSpacing.md },
  body: { gap: PlayTTSpacing.sm },
})
