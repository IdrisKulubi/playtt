import { useEffect, useMemo, useState } from "react"
import { StyleSheet, Switch, Text, View } from "react-native"

import { AccountGlassSection } from "@/components/account/account-glass-section"
import { AccountStackScreen } from "@/components/account/account-stack-screen"
import { Button } from "@/components/ui/button"
import { AuthFormSkeleton } from "@/components/ui/skeleton"
import { PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import {
  useProductTheme,
  useSkeletonSurface,
} from "@/hooks/use-product-theme"
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notification-api"
import {
  disablePushNotifications,
  enablePushNotifications,
  isPushPermissionGranted,
} from "@/lib/push-notifications"
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
  const skeletonSurface = useSkeletonSurface()
  const [prefs, setPrefs] = useState(DEFAULT_NOTIFICATION_PREFERENCES)
  const [isLoading, setIsLoading] = useState(true)
  const [isPushLoading, setIsPushLoading] = useState(true)
  const [isPushSaving, setIsPushSaving] = useState(false)
  const [savingPrefKey, setSavingPrefKey] = useState<PrefKey | null>(null)
  const [pushEnabled, setPushEnabled] = useState(false)

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const [preferences, granted] = await Promise.all([
          fetchNotificationPreferences(),
          isPushPermissionGranted(),
        ])
        if (mounted) {
          setPrefs(preferences)
          setPushEnabled(granted)
        }
      } catch (error) {
        toast.apiError(error, "Could not load notification settings.")
      } finally {
        if (mounted) {
          setIsLoading(false)
          setIsPushLoading(false)
        }
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [])

  async function updatePref(key: PrefKey, value: boolean) {
    const previous = prefs
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    setSavingPrefKey(key)
    try {
      setPrefs(await updateNotificationPreferences(next))
    } catch (error) {
      setPrefs(previous)
      toast.apiError(error, "Could not save notification settings.")
    } finally {
      setSavingPrefKey(null)
    }
  }

  async function togglePush() {
    setIsPushSaving(true)
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
      setIsPushSaving(false)
    }
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: PlayTTSpacing.md,
          paddingVertical: PlayTTSpacing.md,
          paddingHorizontal: PlayTTSpacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
        rowLast: {
          borderBottomWidth: 0,
        },
        copy: { flex: 1, gap: 2 },
        title: {
          fontSize: 16,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        description: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 18,
        },
        pushBlock: {
          gap: PlayTTSpacing.md,
          paddingHorizontal: PlayTTSpacing.md,
          paddingVertical: PlayTTSpacing.md,
        },
        note: {
          fontSize: 12,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 18,
          paddingHorizontal: PlayTTSpacing["2xs"],
        },
      }),
    [theme],
  )

  return (
    <AccountStackScreen
      title="Notifications"
      description="Choose what PlayTT sends you. Entry codes are never included in notifications; open the authenticated booking to reveal one."
    >
      <AccountGlassSection title="This device">
        <View style={styles.pushBlock}>
          {isPushLoading ? (
            <AuthFormSkeleton surface={skeletonSurface} />
          ) : (
            <Button
              label={
                pushEnabled
                  ? "Disable push on this device"
                  : "Enable push on this device"
              }
              surface="product"
              productTheme={theme}
              variant={pushEnabled ? "outline" : "primary"}
              loading={isPushSaving}
              onPress={() => void togglePush()}
            />
          )}
        </View>
      </AccountGlassSection>

      <AccountGlassSection title="Alerts">
        {isLoading ? (
          <View style={styles.pushBlock}>
            <AuthFormSkeleton surface={skeletonSurface} />
          </View>
        ) : (
          PREF_ROWS.map((row, index) => (
            <View
              key={row.key}
              style={[
                styles.row,
                index === PREF_ROWS.length - 1 && styles.rowLast,
              ]}
            >
              <View style={styles.copy}>
                <Text style={styles.title}>{row.title}</Text>
                <Text style={styles.description}>{row.description}</Text>
              </View>
              <Switch
                value={prefs[row.key]}
                disabled={savingPrefKey === row.key}
                accessibilityLabel={row.title}
                accessibilityHint={row.description}
                onValueChange={(value) => void updatePref(row.key, value)}
              />
            </View>
          ))
        )}
      </AccountGlassSection>

      <Text style={styles.note}>
        If push is unavailable, booking access remains available by refreshing
        your booking.
      </Text>
    </AccountStackScreen>
  )
}
