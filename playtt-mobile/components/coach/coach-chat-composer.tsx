import { useMemo } from "react"
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"

import { LiquidGlassShell } from "@/components/ui/liquid-glass-shell"
import { resolveColorScheme } from "@/constants/theme"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTRadius,
} from "@/constants/playtt-tokens"
import { useColorScheme } from "@/hooks/use-color-scheme"
import { useProductTheme } from "@/hooks/use-product-theme"
import { canUseLiquidGlass } from "@/lib/liquid-glass"

type CoachChatComposerProps = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled?: boolean
  isSending?: boolean
}

export function CoachChatComposer({
  value,
  onChange,
  onSend,
  disabled = false,
  isSending = false,
}: CoachChatComposerProps) {
  const theme = useProductTheme()
  const colorScheme = resolveColorScheme(useColorScheme())
  const useNativeGlass = canUseLiquidGlass()
  const canSend = value.trim().length > 0 && !disabled && !isSending

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flexDirection: "row",
          alignItems: "flex-end",
          gap: PlayTTSpacing.xs,
          paddingHorizontal: PlayTTSpacing.xl,
          paddingTop: PlayTTSpacing.xs,
          paddingBottom: PlayTTSpacing.xs,
          backgroundColor: "transparent",
          overflow: "hidden",
        },
        rootFallback: {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.border,
          backgroundColor: theme.background,
        },
        inputWrap: {
          flex: 1,
          minHeight: 40,
          maxHeight: 100,
          borderRadius: PlayTTRadius.pill,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.card,
          paddingHorizontal: PlayTTSpacing.sm,
          paddingVertical: PlayTTSpacing.xs,
          justifyContent: "center",
        },
        input: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.foreground,
          lineHeight: 18,
          paddingVertical: 0,
        },
        send: {
          minWidth: 52,
          height: 40,
          borderRadius: PlayTTRadius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: canSend ? PlayTTColors.primary : theme.elevated,
        },
        sendPressed: {
          opacity: 0.85,
        },
        sendLabel: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: canSend ? PlayTTColors.primaryForeground : theme.muted,
        },
        content: {
          flexDirection: "row",
          alignItems: "flex-end",
          gap: PlayTTSpacing.xs,
          flex: 1,
        },
      }),
    [canSend, theme],
  )

  return (
    <View style={[styles.root, !useNativeGlass && styles.rootFallback]}>
      <LiquidGlassShell
        colorScheme={colorScheme}
        style={StyleSheet.absoluteFill}
        shape="rectangle"
        borderRadius={0}
        variant="regular"
        blurIntensity={72}
      />

      <View style={styles.content}>
        <View style={styles.inputWrap}>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="Ask your coach…"
            placeholderTextColor={theme.muted}
            style={styles.input}
            multiline
            editable={!disabled && !isSending}
            returnKeyType="send"
            onSubmitEditing={() => {
              if (canSend) {
                onSend()
              }
            }}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          disabled={!canSend}
          onPress={onSend}
          style={({ pressed }) => [
            styles.send,
            pressed && canSend && styles.sendPressed,
          ]}
        >
          <Text style={styles.sendLabel}>{isSending ? "…" : "Send"}</Text>
        </Pressable>
      </View>
    </View>
  )
}
