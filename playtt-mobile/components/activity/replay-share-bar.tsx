import { useMemo } from "react"
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"

import { GlassPanel } from "@/components/ui/glass-panel"
import { IconSymbol } from "@/components/ui/icon-symbol"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import {
  type ReplayShareAction,
  useReplayShare,
} from "@/hooks/use-replay-share"
import { useProductTheme } from "@/hooks/use-product-theme"
import { USE_LIVE_ACTIVITY_CLIPS } from "@/lib/mock/mock-config"
import type { ReplaySummary } from "@/lib/replay-types"

type ReplayShareBarProps = {
  replay: ReplaySummary
}

type ShareActionConfig = {
  id: ReplayShareAction
  label: string
  icon: "square.and.arrow.up" | "arrow.down.circle.fill" | "link"
  primary?: boolean
  accessibilityLabel: string
  onPress: () => void
}

function ShareActionButton({
  config,
  disabled,
  busy,
  theme,
}: {
  config: ShareActionConfig
  disabled: boolean
  busy: boolean
  theme: ReturnType<typeof useProductTheme>
}) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        pressable: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: PlayTTSpacing["2xs"],
          paddingVertical: PlayTTSpacing.sm,
          paddingHorizontal: PlayTTSpacing.xs,
          opacity: disabled ? 0.45 : 1,
        },
        iconWrap: {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: config.primary
            ? PlayTTColors.primaryGlow
            : theme.elevated,
        },
        label: {
          fontSize: 12,
          fontFamily: PlayTTFontFamilies.medium,
          color: config.primary ? PlayTTColors.primary : theme.foreground,
          textAlign: "center",
        },
        busyLabel: {
          fontSize: 11,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          textAlign: "center",
        },
      }),
    [config.primary, disabled, theme],
  )

  const iconColor = config.primary ? PlayTTColors.primary : theme.foreground

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={config.accessibilityLabel}
      accessibilityState={{ disabled, busy }}
      disabled={disabled || busy}
      onPress={config.onPress}
      style={({ pressed }) => [
        styles.pressable,
        pressed && !disabled && !busy && { opacity: 0.85 },
      ]}
    >
      <View style={styles.iconWrap}>
        {busy ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <IconSymbol name={config.icon} size={22} color={iconColor} />
        )}
      </View>
      <Text style={styles.label}>
        {busy ? "Preparing…" : config.label}
      </Text>
      {busy ? (
        <Text style={styles.busyLabel}>Downloading clip</Text>
      ) : null}
    </Pressable>
  )
}

export function ReplayShareBar({ replay }: ReplayShareBarProps) {
  const theme = useProductTheme()
  const { busyAction, onShare, onSave, onCopyLink } = useReplayShare(replay)

  const canShare =
    USE_LIVE_ACTIVITY_CLIPS && replay.status === "ready"
  const disabled = !canShare || busyAction !== null

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: PlayTTSpacing.xs,
        },
        row: {
          flexDirection: "row",
          alignItems: "stretch",
        },
        hint: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 18,
          paddingHorizontal: PlayTTSpacing.xs,
        },
      }),
    [theme],
  )

  const actions: ShareActionConfig[] = [
    {
      id: "share",
      label: "Share",
      icon: "square.and.arrow.up",
      primary: true,
      accessibilityLabel: "Share clip",
      onPress: onShare,
    },
    {
      id: "save",
      label: "Save",
      icon: "arrow.down.circle.fill",
      accessibilityLabel: "Save to Photos",
      onPress: onSave,
    },
    {
      id: "link",
      label: "Link",
      icon: "link",
      accessibilityLabel: "Copy PlayTT link",
      onPress: onCopyLink,
    },
  ]

  if (!USE_LIVE_ACTIVITY_CLIPS) {
    return (
      <Text style={styles.hint}>
        Share and save unlock when live session clips are enabled.
      </Text>
    )
  }

  return (
    <View style={styles.root}>
      <GlassPanel contentStyle={styles.row}>
        {actions.map((action) => (
          <ShareActionButton
            key={action.id}
            config={action}
            disabled={disabled}
            busy={busyAction === action.id}
            theme={theme}
          />
        ))}
      </GlassPanel>
      {!canShare ? (
        <Text style={styles.hint}>
          {replay.status === "ready"
            ? "This clip cannot be shared right now."
            : "Sharing is available when your clip is ready."}
        </Text>
      ) : (
        <Text style={styles.hint}>
          Share to WhatsApp, Instagram, and more — or save to your gallery.
        </Text>
      )}
    </View>
  )
}
