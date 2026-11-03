import { Linking, StyleSheet, View } from "react-native"

import { AccountStackScreen } from "@/components/account/account-stack-screen"
import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"

const SUPPORT_EMAIL = "hello@theplaytt.com"

const ALL_FAQ = [
  {
    question: "How do I book a table?",
    answer:
      "On Play, tap Book a table. Pick a day and time, choose how many players, check the details, then pay to confirm.",
  },
  {
    question: "Can I change my booking?",
    answer:
      "Yes. Open the booking in Bookings and tap Change booking. You can change the time or add players up to 2 hours before you play.",
  },
  {
    question: "How do I get in at the venue?",
    answer:
      "Open your confirmed booking and tap Show entry code. Use that code at the venue door while it's valid.",
  },
  {
    question: "Need help at the venue?",
    answer: `Email us at ${SUPPORT_EMAIL} and we'll help you.`,
  },
  {
    question: "How do replays work?",
    answer:
      "Press Replay during a game and PlayTT saves the last 30 seconds. Find your clips in Progress.",
  },
  {
    question: "Can I delete my account?",
    answer: "Yes. Open Me, then Delete account. Cancel any upcoming bookings first.",
  },
]

const FAQ = ALL_FAQ

export default function HelpScreen() {
  return (
    <AccountStackScreen title="Help" description="Quick answers about bookings, entry codes and replays.">
      {FAQ.map((item) => (
        <Card key={item.question}>
          <View style={styles.card}>
            <AppText variant="headline" accessibilityRole="header">
              {item.question}
            </AppText>
            <AppText variant="body" color="secondaryLabel">
              {item.answer}
            </AppText>
          </View>
        </Card>
      ))}
      <Button
        label="Email support"
        variant="secondary"
        onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
      />
    </AccountStackScreen>
  )
}

const styles = StyleSheet.create({
  card: { gap: PlayTTSpacing.xs },
})
