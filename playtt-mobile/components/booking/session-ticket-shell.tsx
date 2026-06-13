import type { ImageSource } from "expo-image"
import { Image } from "expo-image"
import type { ReactNode } from "react"
import { useMemo } from "react"
import { Pressable, StyleSheet, View } from "react-native"

import { IconSymbol } from "@/components/ui/icon-symbol"
import {
  PlayTTColors,
  PlayTTRadius,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

const THUMB_SIZE = 72

type SessionTicketShellProps = {
  imageSource: ImageSource
  imageLabel: string
  primary: ReactNode
  secondary?: ReactNode
  tertiary?: ReactNode
  footer?: ReactNode
  onPress?: () => void
  embedded?: boolean
  selected?: boolean
  accessibilityHint?: string
}

export function SessionTicketShell({
  imageSource,
  imageLabel,
  primary,
  secondary,
  tertiary,
  footer,
  onPress,
  embedded = false,
  selected = false,
  accessibilityHint = "Opens details",
}: SessionTicketShellProps) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderRadius: embedded ? PlayTTRadius.lg : PlayTTRadius.card,
          borderWidth: embedded ? 0 : 1,
          borderColor: selected ? PlayTTColors.primary : theme.border,
          backgroundColor: theme.card,
          overflow: "hidden",
        },
        mainRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: PlayTTSpacing.sm,
          paddingHorizontal: PlayTTSpacing.sm,
          paddingVertical: PlayTTSpacing.sm,
          minHeight: 44,
        },
        thumb: {
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          borderRadius: PlayTTRadius.lg,
          backgroundColor: theme.elevated,
          overflow: "hidden",
        },
        image: {
          width: "100%",
          height: "100%",
        },
        meta: {
          flex: 1,
          gap: PlayTTSpacing["2xs"],
          minWidth: 0,
        },
        footer: {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.border,
          paddingHorizontal: PlayTTSpacing.sm,
          paddingVertical: PlayTTSpacing.xs,
          minHeight: 36,
          justifyContent: "center",
        },
        pressed: {
          opacity: 0.92,
        },
      }),
    [embedded, selected, theme],
  )

  const content = (
    <>
      <View style={styles.mainRow}>
        <View style={styles.thumb}>
          <Image
            source={imageSource}
            style={styles.image}
            contentFit="cover"
            accessibilityLabel={imageLabel}
          />
        </View>
        <View style={styles.meta}>
          {primary}
          {secondary}
          {tertiary}
        </View>
        {onPress ? (
          <IconSymbol name="chevron.right" size={18} color={theme.muted} />
        ) : null}
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </>
  )

  if (!onPress) {
    return <View style={styles.card}>{content}</View>
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  )
}

export { THUMB_SIZE as SESSION_TICKET_THUMB_SIZE }
