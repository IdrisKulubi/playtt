import { useMemo } from "react"
import { StyleSheet, Text } from "react-native"

import { AccountStackScreen } from "@/components/account/account-stack-screen"
import { GlassPanel } from "@/components/ui/glass-panel"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

const FAQ = [
  {
    question: "How do I book a session?",
    answer:
      "Tap Book on Home, pick a time, choose your group size, and confirm. Pay to lock in your slot.",
  },
  {
    question: "Can I change my booking?",
    answer:
      "Yes. Open your booking and tap Edit. You can change time or add players up to 2 hours before start.",
  },
  {
    question: "How do I get into the pod?",
    answer:
      "Open your confirmed booking, reveal the entry code, and use that same code at each listed venue door during its validity window.",
  },
  {
    question: "Need help at the venue?",
    answer: "Message support at hello@theplaytt.com and we will assist you.",
  },
  {
    question: "How do clip packs work?",
    answer:
      "Buy a 10-clip pack in Activity or Coach. Each clip captures the last 30 seconds when you press Replay during a session.",
  },
  {
    question: "What is Coach?",
    answer:
      "Coach is a monthly subscription that reviews your captured clips and suggests drills to practice. Clip packs are sold separately.",
  },
]

export default function HelpScreen() {
  const theme = useProductTheme()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        question: {
          fontSize: 15,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        answer: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 20,
          marginTop: PlayTTSpacing.xs,
        },
        card: {
          gap: PlayTTSpacing.xs,
        },
      }),
    [theme],
  )

  return (
    <AccountStackScreen
      title="Help"
      description="Quick answers about bookings, access, clips, and Coach."
    >
      {FAQ.map((item) => (
        <GlassPanel key={item.question} contentStyle={styles.card}>
          <Text style={styles.question}>{item.question}</Text>
          <Text style={styles.answer}>{item.answer}</Text>
        </GlassPanel>
      ))}
    </AccountStackScreen>
  )
}
