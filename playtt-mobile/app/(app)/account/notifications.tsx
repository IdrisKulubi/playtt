import { useEffect, useMemo, useState } from "react"
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AccountScreenHeader } from "@/components/account/account-screen-header"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { Button } from "@/components/ui/button"
import { PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notification-api"
import { disablePushNotifications, enablePushNotifications } from "@/lib/push-notifications"
import { toast } from "@/lib/toast"

type PrefKey = keyof NotificationPreferences

const PREF_ROWS: { key: PrefKey; title: string; description: string }[] = [
  { key: "accessReady", title: "Access ready", description: "Know when your venue entry code is ready to reveal." },
  { key: "accessFailed", title: "Access support", description: "Get help quickly if venue access needs attention." },
  { key: "sessionReminder", title: "Session reminder", description: "Get a heads-up before your booking starts." },
  { key: "sessionWarning", title: "Five-minute warning", description: "Know when your session is nearly finished." },
  { key: "sessionEnded", title: "Session ended", description: "Get confirmation when the session closes." },
  { key: "replayReady", title: "Replay ready", description: "Know when a clip from your session is available." },
]

export default function NotificationsScreen() {
  const theme = useProductTheme()
  const screenStyles = useMemo(() => createAppScreenStyles(theme), [theme])
  const [prefs, setPrefs] = useState(DEFAULT_NOTIFICATION_PREFERENCES)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)

  useEffect(() => {
    let mounted = true
    fetchNotificationPreferences()
      .then((value) => { if (mounted) setPrefs(value) })
      .catch((error) => toast.apiError(error, "Could not load notification settings."))
      .finally(() => { if (mounted) setIsLoading(false) })
    return () => { mounted = false }
  }, [])

  async function updatePref(key: PrefKey, value: boolean) {
    const previous = prefs
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    setIsSaving(true)
    try {
      setPrefs(await updateNotificationPreferences(next))
    } catch (error) {
      setPrefs(previous)
      toast.apiError(error, "Could not save notification settings.")
    } finally {
      setIsSaving(false)
    }
  }

  async function togglePush() {
    setIsSaving(true)
    try {
      if (pushEnabled) {
        await disablePushNotifications()
        setPushEnabled(false)
        toast.success("Push disabled on this device.")
      } else {
        await enablePushNotifications()
        setPushEnabled(true)
        toast.success("Push enabled on this device.")
      }
    } catch (error) {
      toast.apiError(error, "Could not update push notifications.")
    } finally {
      setIsSaving(false)
    }
  }

  const styles = useMemo(() => StyleSheet.create({
    intro: { fontSize: 14, fontFamily: PlayTTFontFamilies.regular, color: theme.muted, lineHeight: 20, marginBottom: PlayTTSpacing.md },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: PlayTTSpacing.md, paddingVertical: PlayTTSpacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
    copy: { flex: 1, gap: 2 },
    title: { fontSize: 16, fontFamily: PlayTTFontFamilies.medium, color: theme.foreground },
    description: { fontSize: 13, fontFamily: PlayTTFontFamilies.regular, color: theme.muted, lineHeight: 18 },
    section: { gap: PlayTTSpacing.sm, marginBottom: PlayTTSpacing.lg },
    note: { fontSize: 12, fontFamily: PlayTTFontFamilies.regular, color: theme.muted, lineHeight: 18 },
  }), [theme])

  return (
    <SafeAreaView style={screenStyles.safeArea}>
      <AccountScreenHeader title="Notifications" />
      <ScrollView contentContainerStyle={screenStyles.scroll}>
        <View style={styles.section}>
          <Text style={styles.intro}>Choose what PlayTT sends you. Entry codes are never included in notifications; open the authenticated booking to reveal one.</Text>
          <Button label={pushEnabled ? "Disable push on this device" : "Enable push on this device"} surface="product" productTheme={theme} variant={pushEnabled ? "outline" : "primary"} loading={isSaving} onPress={() => void togglePush()} />
        </View>
        {PREF_ROWS.map((row) => (
          <View key={row.key} style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.title}>{row.title}</Text>
              <Text style={styles.description}>{row.description}</Text>
            </View>
            <Switch value={prefs[row.key]} disabled={isLoading || isSaving} onValueChange={(value) => void updatePref(row.key, value)} />
          </View>
        ))}
        <Text style={styles.note}>If push is unavailable, booking access remains available by refreshing your booking.</Text>
      </ScrollView>
    </SafeAreaView>
  )
}
