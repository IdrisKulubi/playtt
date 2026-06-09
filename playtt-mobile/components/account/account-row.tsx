import { Pressable, StyleSheet, Text, View } from "react-native"

import { IconSymbol } from "@/components/ui/icon-symbol"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"

type AccountRowProps = {
  title: string
  subtitle?: string
  value?: string
  onPress?: () => void
  showChevron?: boolean
  destructive?: boolean
  isLast?: boolean
  accessibilityHint?: string
}

export function AccountRow({
  title,
  subtitle,
  value,
  onPress,
  showChevron = Boolean(onPress),
  destructive = false,
  isLast = false,
  accessibilityHint,
}: AccountRowProps) {
  const containerStyle = [styles.container, isLast && styles.containerLast]

  const content = (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={[styles.title, destructive && styles.destructive]}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {value ? <Text style={styles.value}>{value}</Text> : null}
      </View>
      {showChevron ? (
        <IconSymbol
          name="chevron.right"
          size={18}
          color={PlayTTColors.mutedText}
        />
      ) : null}
    </View>
  )

  if (!onPress) {
    return <View style={containerStyle}>{content}</View>
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        ...containerStyle,
        pressed && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: PlayTTSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PlayTTColors.border,
  },
  containerLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
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
    color: PlayTTColors.foreground,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.mutedText,
  },
  value: {
    fontSize: 13,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.mutedText,
    marginTop: 2,
  },
  destructive: {
    color: PlayTTColors.destructive,
  },
})
