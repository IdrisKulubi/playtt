import { router } from "expo-router"
import type { ReactNode } from "react"
import { useMemo } from "react"
import { Linking, Pressable, StyleSheet, Text, View } from "react-native"

import { IconSymbol } from "@/components/ui/icon-symbol"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { UserBookingSummary } from "@/lib/booking-types"
import { formatLastSessionLabel, formatSecondSessionLabel } from "@/lib/booking-utils"

type HomeLinkRowProps = {
  title: string
  subtitle?: string
  onPress: () => void
  trailing?: ReactNode
  isLast?: boolean
}

function HomeLinkRow({
  title,
  subtitle,
  onPress,
  trailing,
  isLast = false,
}: HomeLinkRowProps) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingVertical: PlayTTSpacing.md,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
        pressed: {
          opacity: 0.7,
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: PlayTTSpacing.sm,
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
        subtitle: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
        },
        trailing: {
          flexDirection: "row",
          alignItems: "center",
          gap: PlayTTSpacing.xs,
        },
      }),
    [isLast, theme],
  )

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.trailing}>
          {trailing}
          <IconSymbol name="chevron.right" size={18} color={theme.muted} />
        </View>
      </View>
    </Pressable>
  )
}

function openDirections(locationName: string) {
  const query = encodeURIComponent(locationName)
  void Linking.openURL(
    `https://www.google.com/maps/search/?api=1&query=${query}`,
  )
}

type HomeLinksSectionProps = {
  showBookAnother?: boolean
  upcomingBooking?: UserBookingSummary | null
  secondUpcomingBooking?: UserBookingSummary | null
  lastPastBooking?: UserBookingSummary | null
  onOpenBooking?: (bookingId: string) => void
  onOpenCoach?: () => void
}

export function HomeLinksSection({
  showBookAnother = false,
  upcomingBooking = null,
  secondUpcomingBooking = null,
  lastPastBooking = null,
  onOpenBooking,
  onOpenCoach,
}: HomeLinksSectionProps) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          marginTop: PlayTTSpacing.md,
        },
        label: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.muted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: PlayTTSpacing.xs,
        },
      }),
    [theme],
  )

  const showLastSession = !upcomingBooking && lastPastBooking

  return (
    <View style={styles.section}>
      <Text style={styles.label}>More</Text>

      {showBookAnother ? (
        <HomeLinkRow
          title="Book another session"
          onPress={() => router.push("/(app)/book")}
        />
      ) : null}

      {secondUpcomingBooking && onOpenBooking ? (
        <HomeLinkRow
          title="Next session after this"
          subtitle={formatSecondSessionLabel(secondUpcomingBooking)}
          onPress={() => onOpenBooking(secondUpcomingBooking.id)}
        />
      ) : null}

      {upcomingBooking ? (
        <HomeLinkRow
          title="Get directions"
          subtitle={upcomingBooking.locationName}
          onPress={() => openDirections(upcomingBooking.locationName)}
        />
      ) : null}

      {showLastSession ? (
        <HomeLinkRow
          title="Book again"
          subtitle={formatLastSessionLabel(lastPastBooking)}
          onPress={() => router.push("/(app)/book")}
        />
      ) : null}

      {onOpenCoach ? (
        <HomeLinkRow
          title="Open Coach"
          subtitle="Insights, training, and clip packs"
          onPress={onOpenCoach}
          isLast
        />
      ) : null}
    </View>
  )
}
