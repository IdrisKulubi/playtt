import { useMemo } from "react"
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"

import { IconSymbol } from "@/components/ui/icon-symbol"
import {
  liquidGlassLabelColor,
  liquidGlassPillBorderColor,
  liquidGlassSelectionChipColor,
} from "@/components/ui/liquid-glass-chrome"
import {
  LiquidGlassSurface,
  liquidGlassFill,
  useNativeLiquidGlass,
} from "@/components/ui/liquid-glass-surface"
import type { AppColorScheme } from "@/constants/theme"
import { resolveColorScheme } from "@/constants/theme"
import {
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { getFloatingTabBarInset } from "@/constants/navigation-layout"
import { useColorScheme } from "@/hooks/use-color-scheme"
import {
  type ReplayShareAction,
  useReplayShare,
} from "@/hooks/use-replay-share"
import { useProductTheme } from "@/hooks/use-product-theme"
import { USE_LIVE_ACTIVITY_CLIPS } from "@/lib/mock/mock-config"
import type { ReplaySummary } from "@/lib/replay-types"

/** Fixed share dock height (toolbar + vertical margins). */
export const REPLAY_SHARE_DOCK_HEIGHT = 52

type ShareActionConfig = {
  id: ReplayShareAction
  label: string
  icon: "square.and.arrow.up" | "arrow.down.circle.fill" | "link"
  accessibilityLabel: string
  onPress: () => void
}

type ReplayShareToolbarProps = {
  colorScheme: AppColorScheme
  disabled: boolean
  busyAction: ReplayShareAction | null
  actions: ShareActionConfig[]
}

function ReplayShareToolbar({
  colorScheme,
  disabled,
  busyAction,
  actions,
}: ReplayShareToolbarProps) {
  const nativeGlass = useNativeLiquidGlass()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        pill: {
          borderRadius: PlayTTRadius.pill,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: liquidGlassPillBorderColor(colorScheme),
          ...(!nativeGlass
            ? Platform.select({
                ios: {
                  shadowColor: colorScheme === "dark" ? "#000000" : "#0a1628",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: colorScheme === "dark" ? 0.25 : 0.08,
                  shadowRadius: 12,
                },
                android: {
                  elevation: 6,
                },
                default: {},
              })
            : {}),
        },
        pillDisabled: {
          opacity: 0.45,
        },
        row: {
          flexDirection: "row",
          padding: 4,
          gap: 2,
          minHeight: 44,
        },
        segmentSlot: {
          flex: 1,
          flexDirection: "row",
          alignItems: "stretch",
        },
        divider: {
          width: StyleSheet.hairlineWidth,
          alignSelf: "stretch",
          marginVertical: 8,
          backgroundColor: liquidGlassPillBorderColor(colorScheme),
        },
        segmentPressable: {
          flex: 1,
        },
        chip: {
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 6,
          borderRadius: PlayTTRadius.pill,
          minHeight: 36,
        },
        chipPressed: {
          backgroundColor: liquidGlassSelectionChipColor(colorScheme),
        },
        segmentLabel: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.medium,
        },
        segmentLabelPressed: {
          fontFamily: PlayTTFontFamilies.semiBold,
        },
      }),
    [colorScheme, nativeGlass],
  )

  return (
    <View style={[styles.pill, disabled && styles.pillDisabled]}>
      <LiquidGlassSurface colorScheme={colorScheme} style={liquidGlassFill} />
      <View style={styles.row}>
        {actions.map((action, index) => {
          const busy = busyAction === action.id
          return (
            <View key={action.id} style={styles.segmentSlot}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={action.accessibilityLabel}
                accessibilityState={{ disabled, busy }}
                disabled={disabled}
                onPress={action.onPress}
                style={styles.segmentPressable}
              >
                {({ pressed }) => {
                  const highlighted = pressed && !disabled
                  const labelColor = liquidGlassLabelColor(
                    colorScheme,
                    highlighted,
                  )
                  return (
                    <View
                      style={[
                        styles.chip,
                        highlighted && styles.chipPressed,
                      ]}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color={labelColor} />
                      ) : (
                        <IconSymbol
                          name={action.icon}
                          size={17}
                          color={labelColor}
                        />
                      )}
                      <Text
                        style={[
                          styles.segmentLabel,
                          highlighted && styles.segmentLabelPressed,
                          { color: labelColor },
                        ]}
                        numberOfLines={1}
                      >
                        {busy ? "…" : action.label}
                      </Text>
                    </View>
                  )
                }}
              </Pressable>
            </View>
          )
        })}
      </View>
    </View>
  )
}

function useShareActions(replay: ReplaySummary) {
  const { busyAction, onShare, onSave, onCopyLink } = useReplayShare(replay)

  const actions: ShareActionConfig[] = useMemo(
    () => [
      {
        id: "share",
        label: "Share",
        icon: "square.and.arrow.up",
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
        label: "Copy link",
        icon: "link",
        accessibilityLabel: "Copy PlayTT link",
        onPress: onCopyLink,
      },
    ],
    [onCopyLink, onSave, onShare],
  )

  const canShare =
    USE_LIVE_ACTIVITY_CLIPS && replay.status === "ready"
  const disabled = !canShare || busyAction !== null

  return { actions, busyAction, disabled, canShare }
}

type ReplayShareBarProps = {
  replay: ReplaySummary
  variant?: "inline"
}

export function ReplayShareBar({ replay }: ReplayShareBarProps) {
  const theme = useProductTheme()
  const colorScheme = resolveColorScheme(useColorScheme())
  const { actions, busyAction, disabled, canShare } = useShareActions(replay)

  const hintStyle = useMemo(
    () =>
      StyleSheet.create({
        hint: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 18,
        },
      }),
    [theme],
  )

  if (!USE_LIVE_ACTIVITY_CLIPS) {
    return (
      <Text style={hintStyle.hint}>
        Share and save unlock when live session clips are enabled.
      </Text>
    )
  }

  const statusHint =
    !canShare &&
    (replay.status === "ready"
      ? "This clip cannot be shared right now."
      : "Sharing is available when your clip is ready.")

  return (
    <View style={{ gap: PlayTTSpacing.xs }}>
      <ReplayShareToolbar
        colorScheme={colorScheme}
        disabled={disabled}
        busyAction={busyAction}
        actions={actions}
      />
      {statusHint ? <Text style={hintStyle.hint}>{statusHint}</Text> : null}
    </View>
  )
}

type ReplayShareDockProps = {
  replay: ReplaySummary
  bottomInset: number
  style?: StyleProp<ViewStyle>
}

export function ReplayShareDock({
  replay,
  bottomInset,
  style,
}: ReplayShareDockProps) {
  const colorScheme = resolveColorScheme(useColorScheme())
  const { actions, busyAction, disabled } = useShareActions(replay)

  const dockStyles = useMemo(
    () =>
      StyleSheet.create({
        dock: {
          position: "absolute",
          left: PlayTTSpacing.md,
          right: PlayTTSpacing.md,
          bottom: bottomInset + PlayTTSpacing.sm,
        },
      }),
    [bottomInset],
  )

  if (!USE_LIVE_ACTIVITY_CLIPS) {
    return null
  }

  return (
    <View style={[dockStyles.dock, style]} pointerEvents="box-none">
      <ReplayShareToolbar
        colorScheme={colorScheme}
        disabled={disabled}
        busyAction={busyAction}
        actions={actions}
      />
    </View>
  )
}

export function getReplayShareDockScrollPadding(bottomSafeArea: number) {
  return (
    getFloatingTabBarInset(bottomSafeArea) +
    PlayTTSpacing.sm +
    REPLAY_SHARE_DOCK_HEIGHT +
    PlayTTSpacing.md
  )
}
