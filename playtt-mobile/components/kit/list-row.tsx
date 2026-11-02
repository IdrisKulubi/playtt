import type { ComponentProps } from "react"
import { StyleSheet, Switch, View } from "react-native"

import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import type { ColorRoles } from "@/constants/colors"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

type IconName = ComponentProps<typeof IconSymbol>["name"]

export type ListRowTone = "accent" | "success" | "warning" | "destructive" | "neutral"

type ListRowAccessory =
  | { kind: "chevron" }
  | { kind: "value"; value: string }
  | { kind: "toggle"; value: boolean; onValueChange: (next: boolean) => void }
  | { kind: "none" }

type ListRowProps = {
  title: string
  subtitle?: string
  icon?: IconName
  /** Icon tile colour. Pair with words; colour never carries meaning alone. */
  tone?: ListRowTone
  /** Defaults to a chevron when `onPress` is set. */
  accessory?: ListRowAccessory
  onPress?: () => void
  /** Red title for actions like "Sign out". */
  destructive?: boolean
  accessibilityHint?: string
}

function toneColors(tone: ListRowTone, scheme: "light" | "dark", colors: ColorRoles) {
  // Bright dark-mode tones need dark glyphs to keep 3:1 for icons.
  const onTone = scheme === "dark" ? colors.onAccent : "#FFFFFF"
  switch (tone) {
    case "accent":
      return { background: colors.accent, glyph: colors.onAccent }
    case "success":
      return { background: colors.success, glyph: onTone }
    case "warning":
      return { background: colors.warning, glyph: onTone }
    case "destructive":
      return { background: colors.destructive, glyph: "#FFFFFF" }
    case "neutral":
      return { background: colors.secondaryLabel, glyph: scheme === "dark" ? colors.onAccent : "#FFFFFF" }
  }
}

/** One row of a `ListSection`: icon tile, title, subtitle, accessory. Wraps at large text. */
export function ListRow({
  title,
  subtitle,
  icon,
  tone = "accent",
  accessory,
  onPress,
  destructive = false,
  accessibilityHint,
}: ListRowProps) {
  const { scheme, colors } = useAppTheme()
  const resolved: ListRowAccessory = accessory ?? (onPress ? { kind: "chevron" } : { kind: "none" })
  const isToggle = resolved.kind === "toggle"
  const tile = icon ? toneColors(tone, scheme, colors) : null

  // The whole row is the target; a toggle row flips its switch.
  const handlePress = isToggle ? () => resolved.onValueChange(!resolved.value) : onPress

  const content = (
    <>
      {tile && icon ? (
        <View style={[styles.tile, { backgroundColor: tile.background }]}>
          <IconSymbol name={icon} size={18} color={tile.glyph} />
        </View>
      ) : null}
      <View style={styles.text}>
        <AppText variant="body" color={destructive ? "destructive" : "label"}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="subheadline" color="secondaryLabel">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {resolved.kind === "value" ? (
        <AppText variant="body" color="secondaryLabel" style={styles.value}>
          {resolved.value}
        </AppText>
      ) : null}
      {resolved.kind === "toggle" ? (
        <Switch
          value={resolved.value}
          onValueChange={resolved.onValueChange}
          trackColor={{ true: colors.accent }}
          // The row carries the label and role; hide the bare switch.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      {resolved.kind === "chevron" ? (
        <IconSymbol name="chevron.right" size={18} color={colors.tertiaryLabel} />
      ) : null}
    </>
  )

  if (!handlePress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={[title, subtitle].filter(Boolean).join(", ")}>
        {content}
      </View>
    )
  }

  return (
    <PressableScale
      onPress={handlePress}
      pressedScale={1}
      haptic={isToggle ? "commit" : undefined}
      accessibilityRole={isToggle ? "switch" : "button"}
      accessibilityState={isToggle ? { checked: resolved.value } : undefined}
      accessibilityLabel={[title, subtitle].filter(Boolean).join(", ")}
      accessibilityHint={accessibilityHint}
      style={styles.row}
    >
      {content}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: KitLayout.rowMinHeight,
    flexDirection: "row",
    alignItems: "center",
    gap: PlayTTSpacing.sm,
    paddingHorizontal: PlayTTSpacing.md,
    paddingVertical: PlayTTSpacing.sm,
  },
  tile: {
    width: KitLayout.iconTile,
    height: KitLayout.iconTile,
    borderRadius: 8,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 2 },
  value: { maxWidth: "45%", textAlign: "right" },
})
