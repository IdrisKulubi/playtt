import * as Clipboard from "expo-clipboard"
import { router } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { AppState, StyleSheet, View } from "react-native"

import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { fetchBookingAccess, revealBookingAccess } from "@/lib/booking-access-api"
import { formatAccessWindow, getBookingAccessPresentation } from "@/lib/booking-access-presentation"
import type { BookingAccess } from "@/lib/booking-access-types"
import type { UserBookingSummary } from "@/lib/booking-types"
import { toast } from "@/lib/toast"

const HELP_HREF = "/(app)/account/help"

/** Entry code for the venue door: hidden until asked for, cleared when the app goes to the background. */
export function BookingAccessCard({ booking }: { booking: UserBookingSummary }) {
  const { colors } = useAppTheme()
  const [access, setAccess] = useState<BookingAccess | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRevealing, setIsRevealing] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  const loadAccess = useCallback(async () => {
    setCode(null)
    setIsLoading(true)
    setLoadFailed(false)
    try {
      setAccess(await fetchBookingAccess(booking.id))
    } catch {
      setAccess(null)
      setLoadFailed(true)
    } finally {
      setIsLoading(false)
    }
  }, [booking.id])

  useEffect(() => void loadAccess(), [loadAccess])

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") setCode(null)
    })
    return () => {
      subscription.remove()
      setCode(null)
    }
  }, [])

  async function reveal() {
    setCode(null)
    setIsRevealing(true)
    try {
      setCode((await revealBookingAccess(booking.id)).code)
    } catch (error) {
      toast.apiError(error, "Could not show your entry code.")
      await loadAccess()
    } finally {
      setIsRevealing(false)
    }
  }

  async function copyCode() {
    if (!code) return
    await Clipboard.setStringAsync(code)
    toast.success("Entry code copied.")
  }

  if (isLoading) {
    return (
      <Card>
        <View style={styles.stack} accessibilityLiveRegion="polite">
          <AppText variant="headline">Checking your entry code…</AppText>
          <AppText variant="callout" color="secondaryLabel">
            Your booking is still confirmed while we check.
          </AppText>
        </View>
      </Card>
    )
  }

  if (loadFailed || !access) {
    return (
      <Card>
        <View style={styles.stack} accessibilityLiveRegion="polite">
          <AppText variant="headline">Entry code isn&apos;t available right now</AppText>
          <AppText variant="callout" color="secondaryLabel">
            Try again in a moment. Your booking is still confirmed.
          </AppText>
          <Button label="Try again" variant="secondary" onPress={() => void loadAccess()} style={styles.firstAction} />
          <Button label="Get help" variant="plain" onPress={() => router.push(HELP_HREF)} />
        </View>
      </Card>
    )
  }

  const presentation = getBookingAccessPresentation(access.status)
  const windowLabel = formatAccessWindow(access.validFrom, access.validUntil)
  const showSupport = access.status === "action_required" || access.status === "temporarily_unavailable"
  const ready = access.status === "ready"
  const doors = [...access.doors].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <Card style={ready ? { borderWidth: 1.5, borderColor: colors.accent } : undefined}>
      <View style={styles.stack} accessibilityLiveRegion="polite">
        <View style={styles.titleRow}>
          <IconSymbol name="qrcode" size={22} color={colors.accentText} />
          <AppText variant="headline" style={styles.flex}>
            {presentation.title}
          </AppText>
        </View>
        <AppText variant="callout" color="secondaryLabel">
          {access.supportMessage || presentation.body}
        </AppText>

        {code ? (
          <AppText
            variant="largeTitle"
            tabular
            selectable
            style={styles.code}
            accessibilityLabel={`Entry code ${code.split("").join(" ")}`}
          >
            {code}
          </AppText>
        ) : null}

        {windowLabel ? (
          <AppText variant="callout" color="secondaryLabel">
            Works {windowLabel}
          </AppText>
        ) : null}

        {doors.length > 0 ? (
          <View style={styles.doors}>
            <AppText variant="callout" color="secondaryLabel">
              Use the same code at:
            </AppText>
            {doors.map((door, index) => (
              <AppText key={door.accessPointId} variant="callout" weight="600">
                {index + 1}. {door.name}
              </AppText>
            ))}
          </View>
        ) : null}

        <View style={styles.actions}>
          {ready && access.revealable && !code ? (
            <Button label="Show entry code" loading={isRevealing} onPress={() => void reveal()} />
          ) : null}
          {code ? <Button label="Copy code" variant="secondary" onPress={() => void copyCode()} /> : null}
          <Button label="Check again" variant="plain" onPress={() => void loadAccess()} />
          {showSupport ? <Button label="Get help" variant="plain" onPress={() => router.push(HELP_HREF)} /> : null}
        </View>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.xs },
  titleRow: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.xs },
  flex: { flex: 1 },
  code: { textAlign: "center", letterSpacing: 6, marginVertical: PlayTTSpacing.sm },
  doors: { gap: 2 },
  actions: { gap: PlayTTSpacing.xs, marginTop: PlayTTSpacing.sm },
  firstAction: { marginTop: PlayTTSpacing.sm },
})
