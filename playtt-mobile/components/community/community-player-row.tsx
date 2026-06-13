import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { IconSymbol } from "@/components/ui/icon-symbol"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { CommunityPlayer } from "@/lib/mock/mock-community"

type CommunityPlayerRowProps = {
  player: CommunityPlayer
  onPress: () => void
  isLast?: boolean
}

export function CommunityPlayerRow({
  player,
  onPress,
  isLast = false,
}: CommunityPlayerRowProps) {
  const theme = useProductTheme()
  const initial = player.name.charAt(0).toUpperCase()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: "row",
          alignItems: "center",
          gap: PlayTTSpacing.sm,
          paddingVertical: PlayTTSpacing.md,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
        pressed: {
          opacity: 0.7,
        },
        avatar: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: theme.elevated,
          alignItems: "center",
          justifyContent: "center",
        },
        avatarLabel: {
          fontSize: 16,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        copy: {
          flex: 1,
          gap: 2,
        },
        name: {
          fontSize: 16,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.foreground,
        },
        meta: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
        },
      }),
    [isLast, theme],
  )

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarLabel}>{initial}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.name}>{player.name}</Text>
        <Text style={styles.meta}>
          {player.skillLevel} · {player.preferredTime}
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={18} color={theme.muted} />
    </Pressable>
  )
}
