import { useMemo } from "react"
import { StyleSheet, Text } from "react-native"

import { SessionTicketShell } from "@/components/booking/session-ticket-shell"
import { PlayTTFontFamilies } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { LocationSummary } from "@/lib/booking-types"
import { getVenueImage } from "@/lib/venue-assets"

type VenueCardProps = {
  location: Pick<LocationSummary, "name" | "slug" | "address">
  selected?: boolean
  compact?: boolean
  onPress?: () => void
}

export function VenueCard({
  location,
  selected = false,
  compact = false,
  onPress,
}: VenueCardProps) {
  const theme = useProductTheme()
  const imageSource = getVenueImage(location)

  const styles = useMemo(
    () =>
      StyleSheet.create({
        name: {
          fontSize: compact ? 15 : 16,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
          lineHeight: 20,
        },
        address: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 18,
        },
      }),
    [compact, theme],
  )

  return (
    <SessionTicketShell
      imageSource={imageSource}
      imageLabel={`${location.name} venue`}
      selected={selected}
      onPress={onPress}
      accessibilityHint={onPress ? `Select ${location.name}` : undefined}
      primary={
        <Text style={styles.name} numberOfLines={1}>
          {location.name}
        </Text>
      }
      secondary={
        <Text style={styles.address} numberOfLines={2}>
          {location.address}
        </Text>
      }
    />
  )
}
