import { useEffect, useState } from "react"
import { StyleSheet, View } from "react-native"

import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { haptics } from "@/lib/haptics"
import { enablePushNotifications, getPushPermissionState } from "@/lib/push-notifications"
import { toast } from "@/lib/toast"

/**
 * Reason screen before the system notification prompt, shown right after a
 * booking (when a reminder obviously helps). Only appears if we've never
 * asked; the system prompt only appears after the player says yes here.
 */
export function ReminderPrompt() {
  const { colors } = useAppTheme()
  const [visible, setVisible] = useState(false)
  const [isEnabling, setIsEnabling] = useState(false)

  useEffect(() => {
    let mounted = true
    void getPushPermissionState()
      .then((state) => {
        if (mounted) setVisible(state === "undetermined")
      })
      .catch(() => undefined)
    return () => {
      mounted = false
    }
  }, [])

  if (!visible) return null

  async function enable() {
    setIsEnabling(true)
    try {
      await enablePushNotifications()
      haptics.success()
      toast.success("Reminders are on. We'll message you before you play.")
      setVisible(false)
    } catch {
      // Declined at the system prompt: respect it and don't ask again here.
      setVisible(false)
    } finally {
      setIsEnabling(false)
    }
  }

  return (
    <Card>
      <View style={styles.stack}>
        <View style={styles.titleRow}>
          <IconSymbol name="bell.fill" size={22} color={colors.accentText} />
          <AppText variant="headline" style={styles.flex}>
            Want a reminder before you play?
          </AppText>
        </View>
        <AppText variant="callout" color="secondaryLabel">
          We&apos;ll send one message before your game so you don&apos;t miss it. You can turn this off any time in Me.
        </AppText>
        <Button label="Turn on reminders" onPress={() => void enable()} loading={isEnabling} style={styles.cta} />
        <Button label="Not now" variant="plain" onPress={() => setVisible(false)} />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.xs },
  titleRow: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.xs },
  flex: { flex: 1 },
  cta: { marginTop: PlayTTSpacing.sm },
})
