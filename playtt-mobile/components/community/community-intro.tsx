import { ChatCircleDots } from "phosphor-react-native/src/icons/ChatCircleDots"
import { IdentificationCard } from "phosphor-react-native/src/icons/IdentificationCard"
import { PingPong } from "phosphor-react-native/src/icons/PingPong"
import { StyleSheet, View } from "react-native"

import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

const STEPS = [
  { title: "Make your player card", detail: "Your level, how you like to play, and your real stats.", Icon: IdentificationCard },
  { title: "Say you're open to play", detail: "Players at your venue can then see you and invite you.", Icon: PingPong },
  { title: "Play", detail: "Agree a time in chat, then book a table as usual.", Icon: ChatCircleDots },
]

/** First-time gate shown until the player turns on their player card. */
export function CommunityIntro({ onCreate, onEnterCode }: { onCreate: () => void; onEnterCode?: () => void }) {
  const { colors } = useAppTheme()

  return (
    <Card>
      <View style={styles.stack}>
        <AppText variant="title2" accessibilityRole="header">
          Meet players at your venue
        </AppText>
        {STEPS.map(({ title, detail, Icon }, index) => (
          <View key={title} style={styles.step}>
            <View style={[styles.badge, { backgroundColor: colors.fill }]}>
              <Icon size={20} color={colors.accentText} weight="bold" />
            </View>
            <View style={styles.copy}>
              <AppText variant="headline">
                {index + 1}. {title}
              </AppText>
              <AppText variant="callout" color="secondaryLabel">
                {detail}
              </AppText>
            </View>
          </View>
        ))}
        <Button label="Create my card" onPress={onCreate} style={styles.cta} />
        {onEnterCode ? <Button label="I have an invite code" variant="plain" onPress={onEnterCode} /> : null}
        <AppText variant="footnote" color="secondaryLabel">
          Only your first name and last initial are shown. You can hide your card at any time.
        </AppText>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.md },
  step: { flexDirection: "row", gap: PlayTTSpacing.sm, alignItems: "flex-start" },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 2 },
  cta: { marginTop: PlayTTSpacing.xs },
})
