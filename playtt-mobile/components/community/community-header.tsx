import { IdentificationCard } from "phosphor-react-native/src/icons/IdentificationCard"
import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import {
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

type CommunityHeaderProps = {
  venueName?: string | null
  onEditCard?: () => void
}

export function CommunityHeader({ venueName, onEditCard }: CommunityHeaderProps) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: PlayTTSpacing["2xs"],
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: PlayTTSpacing.sm,
        },
        title: {
          ...PlayTTTypography.headline,
          fontSize: 26,
          lineHeight: 30,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
          flex: 1,
        },
        venue: {
          color: theme.muted,
        },
        subtitle: {
          fontSize: 15,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 22,
        },
        iconButton: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.elevated,
        },
      }),
    [theme],
  )

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          Community
          {venueName ? <Text style={styles.venue}> · {venueName}</Text> : null}
        </Text>
        {onEditCard ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit my player card"
            hitSlop={6}
            onPress={onEditCard}
            style={styles.iconButton}
          >
            <IdentificationCard size={20} color={theme.foreground} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.subtitle}>Find someone to play with at your venue.</Text>
    </View>
  )
}
