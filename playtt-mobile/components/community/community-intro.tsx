import { ChatCircleDots } from "phosphor-react-native/src/icons/ChatCircleDots"
import { IdentificationCard } from "phosphor-react-native/src/icons/IdentificationCard"
import { PingPong } from "phosphor-react-native/src/icons/PingPong"
import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { GlassPanel } from "@/components/ui/glass-panel"
import { Button } from "@/components/ui/button"
import { PlayTTColors, PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

const STEPS = [
  { title: "Get your card", detail: "Your skill tier, play style and real stats.", Icon: IdentificationCard },
  { title: "Go open", detail: "Tap Open to play so players at your venue can find you.", Icon: PingPong },
  { title: "Play", detail: "Agree a time in chat, then book a table as usual.", Icon: ChatCircleDots },
]

/** First-time gate shown until the player turns on their community profile. */
export function CommunityIntro({ onCreate }: { onCreate: () => void }) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        panel: { borderRadius: 20 },
        content: { gap: PlayTTSpacing.md, padding: PlayTTSpacing.lg },
        title: { fontFamily: PlayTTFontFamilies.bold, fontSize: 22, color: theme.foreground },
        step: { flexDirection: "row", gap: PlayTTSpacing.sm, alignItems: "flex-start" },
        badge: {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0, 183, 255, 0.14)",
        },
        copy: { flex: 1, gap: 2 },
        stepTitle: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 16, color: theme.foreground },
        stepDetail: { fontFamily: PlayTTFontFamilies.regular, fontSize: 14, color: theme.muted, lineHeight: 20 },
        privacy: { fontFamily: PlayTTFontFamilies.regular, fontSize: 12, color: theme.muted, lineHeight: 18 },
      }),
    [theme],
  )

  return (
    <GlassPanel style={styles.panel} contentStyle={styles.content}>
      <Text style={styles.title}>Meet players at your venue</Text>
      {STEPS.map(({ title, detail, Icon }, index) => (
        <View key={title} style={styles.step}>
          <View style={styles.badge}>
            <Icon size={18} color={PlayTTColors.primary} weight="bold" />
          </View>
          <View style={styles.copy}>
            <Text style={styles.stepTitle}>
              {index + 1}. {title}
            </Text>
            <Text style={styles.stepDetail}>{detail}</Text>
          </View>
        </View>
      ))}
      <Button label="Create my card" surface="product" productTheme={theme} onPress={onCreate} />
      <Text style={styles.privacy}>
        Only your first name and last initial are shown. You can hide your card at any time.
      </Text>
    </GlassPanel>
  )
}
