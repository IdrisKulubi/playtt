import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { Button } from "@/components/ui/button"
import { GlassPanel } from "@/components/ui/glass-panel"
import { IconSymbol } from "@/components/ui/icon-symbol"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

type ClipBalanceBarProps = {
  balance: number | null
  onBuyClips: () => void
}

function formatClipBalanceLabel(balance: number | null) {
  if (balance === null) {
    return "— clips left"
  }
  if (balance === 1) {
    return "1 clip left"
  }
  return `${balance} clips left`
}

function formatClipBalanceHint(balance: number | null) {
  if (balance === null) {
    return "Checking your clip balance"
  }
  if (balance === 0) {
    return "Buy more to capture future clips"
  }
  return "Use a credit when you capture in session"
}

export function ClipBalanceBar({ balance, onBuyClips }: ClipBalanceBarProps) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: PlayTTSpacing.sm,
        },
        iconShell: {
          width: 36,
          height: 36,
          borderRadius: PlayTTRadius.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
        },
        copy: {
          flex: 1,
          gap: 2,
          minWidth: 0,
        },
        title: {
          fontSize: 15,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        hint: {
          fontSize: 12,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 16,
        },
      }),
    [theme],
  )

  return (
    <GlassPanel contentStyle={{ paddingVertical: 12, paddingHorizontal: 14 }}>
      <View style={styles.row}>
        <View style={styles.iconShell}>
          <IconSymbol
            name="play.circle.fill"
            size={20}
            color={PlayTTColors.primary}
          />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{formatClipBalanceLabel(balance)}</Text>
          <Text style={styles.hint}>{formatClipBalanceHint(balance)}</Text>
        </View>
        <Button
          label="Buy clips"
          variant="primary"
          surface="product"
          productTheme={theme}
          compact
          fullWidth={false}
          onPress={onBuyClips}
          accessibilityLabel="Buy clips"
        />
      </View>
    </GlassPanel>
  )
}
