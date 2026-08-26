import * as Clipboard from "expo-clipboard"
import { router } from "expo-router"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AppState, StyleSheet, Text, View } from "react-native"

import { Button } from "@/components/ui/button"
import { PlayTTColors, PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { fetchBookingAccess, revealBookingAccess } from "@/lib/booking-access-api"
import { formatAccessWindow, getBookingAccessPresentation } from "@/lib/booking-access-presentation"
import type { BookingAccess } from "@/lib/booking-access-types"
import type { UserBookingSummary } from "@/lib/booking-types"
import { toast } from "@/lib/toast"

export function BookingAccessCard({ booking }: { booking: UserBookingSummary }) {
  const theme = useProductTheme()
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

  const styles = useMemo(() => StyleSheet.create({
    card: { gap: PlayTTSpacing.sm, borderWidth: 1, borderColor: "rgba(0, 183, 255, 0.35)", borderRadius: 12, padding: PlayTTSpacing.md, backgroundColor: theme.card, overflow: "hidden" },
    glow: { ...StyleSheet.absoluteFillObject, backgroundColor: PlayTTColors.primaryGlow, opacity: 0.15, borderRadius: 12 },
    title: { fontSize: 15, fontFamily: PlayTTFontFamilies.semiBold, color: theme.foreground },
    code: { fontSize: 32, fontFamily: PlayTTFontFamilies.semiBold, color: theme.foreground, letterSpacing: 5, textAlign: "center", marginVertical: PlayTTSpacing.sm },
    meta: { fontSize: 13, fontFamily: PlayTTFontFamilies.regular, color: theme.muted, lineHeight: 18 },
    doorList: { gap: 4 },
    door: { fontSize: 13, fontFamily: PlayTTFontFamilies.medium, color: theme.foreground },
    actions: { gap: PlayTTSpacing.xs },
  }), [theme])

  async function reveal() {
    setCode(null)
    setIsRevealing(true)
    try {
      setCode((await revealBookingAccess(booking.id)).code)
    } catch (error) {
      toast.apiError(error, "Could not reveal your entry code.")
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
    return <View style={styles.card} accessibilityLiveRegion="polite"><Text style={styles.title}>Checking venue access…</Text><Text style={styles.meta}>Your booking remains confirmed while we check.</Text></View>
  }

  if (loadFailed || !access) {
    return (
      <View style={styles.card} accessibilityLiveRegion="polite">
        <Text style={styles.title}>Access is temporarily unavailable</Text>
        <Text style={styles.meta}>Refresh in a moment. Your booking is still confirmed.</Text>
        <View style={styles.actions}>
          <Button label="Refresh access" surface="product" productTheme={theme} variant="outline" onPress={() => void loadAccess()} />
          <Button label="Get help" surface="product" productTheme={theme} variant="ghost" onPress={() => router.push("/(app)/account/help")} />
        </View>
      </View>
    )
  }

  const presentation = getBookingAccessPresentation(access.status)
  const windowLabel = formatAccessWindow(access.validFrom, access.validUntil)
  const showSupport = access.status === "action_required" || access.status === "temporarily_unavailable"

  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      {access.status === "ready" ? <View style={styles.glow} pointerEvents="none" /> : null}
      <Text style={styles.title}>{presentation.title}</Text>
      <Text style={styles.meta}>{access.supportMessage || presentation.body}</Text>
      {code ? <Text selectable style={styles.code} accessibilityLabel={`Entry code ${code}`}>{code}</Text> : null}
      {windowLabel ? <Text style={styles.meta}>Valid {windowLabel}</Text> : null}
      {access.doors.length > 0 ? (
        <View style={styles.doorList}>
          <Text style={styles.meta}>Use the same code at:</Text>
          {[...access.doors].sort((a, b) => a.sortOrder - b.sortOrder).map((door, index) => (
            <Text key={door.accessPointId} style={styles.door}>{index + 1}. {door.name}</Text>
          ))}
        </View>
      ) : null}
      <View style={styles.actions}>
        {access.status === "ready" && access.revealable && !code ? <Button label="Reveal entry code" surface="product" productTheme={theme} loading={isRevealing} onPress={() => void reveal()} /> : null}
        {code ? <Button label="Copy code" surface="product" productTheme={theme} onPress={() => void copyCode()} /> : null}
        <Button label="Refresh access" surface="product" productTheme={theme} variant="outline" onPress={() => void loadAccess()} />
        {showSupport ? <Button label="Get help" surface="product" productTheme={theme} variant="ghost" onPress={() => router.push("/(app)/account/help")} /> : null}
      </View>
    </View>
  )
}
