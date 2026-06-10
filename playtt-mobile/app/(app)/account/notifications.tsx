import { useEffect, useMemo, useState } from "react"
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AccountScreenHeader } from "@/components/account/account-screen-header"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPrefs,
} from "@/lib/notification-prefs"

type PrefKey = keyof NotificationPrefs

const PREF_ROWS: { key: PrefKey; title: string; description: string }[] = [
  {
    key: "sessionReminders",
    title: "Session reminders",
    description: "Get a heads-up before your booking starts.",
  },
  {
    key: "replayReady",
    title: "Replay ready",
    description: "Know when a clip from your session is available.",
  },
  {
    key: "bookingUpdates",
    title: "Booking updates",
    description: "Changes, payments, and confirmations.",
  },
]

export default function NotificationsScreen() {
  const theme = useProductTheme()
  const screenStyles = useMemo(() => createAppScreenStyles(theme), [theme])
  const styles = useMemo(
    () =>
      StyleSheet.create({
        intro: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 20,
          marginBottom: PlayTTSpacing.md,
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: PlayTTSpacing.md,
          paddingVertical: PlayTTSpacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
        copy: {
          flex: 1,
          gap: 2,
        },
        title: {
          fontSize: 16,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.foreground,
        },
        description: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 18,
        },
        note: {
          fontSize: 12,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          marginTop: PlayTTSpacing.lg,
          lineHeight: 18,
        },
      }),
    [theme],
  )

  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null)

  useEffect(() => {
    void loadNotificationPrefs().then(setPrefs)
  }, [])

  async function updatePref(key: PrefKey, value: boolean) {
    if (!prefs) {
      return
    }

    const next = { ...prefs, [key]: value }
    setPrefs(next)
    await saveNotificationPrefs(next)
  }

  return (
    <SafeAreaView style={screenStyles.safeArea}>
      <AccountScreenHeader title="Notifications" />
      <ScrollView contentContainerStyle={screenStyles.scroll}>
        <Text style={styles.intro}>
          Choose what you want to hear about. Push delivery is coming soon —
          these preferences are saved on your device for now.
        </Text>

        {prefs
          ? PREF_ROWS.map((row) => (
              <View key={row.key} style={styles.row}>
                <View style={styles.copy}>
                  <Text style={styles.title}>{row.title}</Text>
                  <Text style={styles.description}>{row.description}</Text>
                </View>
                <Switch
                  value={prefs[row.key]}
                  onValueChange={(value) => void updatePref(row.key, value)}
                />
              </View>
            ))
          : null}

        <Text style={styles.note}>
          We will use these settings when push notifications launch.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}
