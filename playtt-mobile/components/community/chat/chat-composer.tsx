import { Plus } from "phosphor-react-native/src/icons/Plus"
import { useMemo } from "react"
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"

import { PlayTTColors, PlayTTFontFamilies, PlayTTRadius, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { QUICK_REPLIES } from "@/lib/community-types"

const MESSAGE_MAX = 1000

type ChatComposerProps = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onQuickReply: (text: string) => void
  onOpenActions: () => void
  disabled?: boolean
  disabledReason?: string | null
  bottomInset: number
  /** Group chats have no booking actions. */
  showActions?: boolean
}

// Same shape as components/coach/coach-chat-composer.tsx, plus quick replies
// and the booking actions button.
export function ChatComposer({
  value,
  onChange,
  onSend,
  onQuickReply,
  onOpenActions,
  disabled = false,
  disabledReason,
  bottomInset,
  showActions = true,
}: ChatComposerProps) {
  const theme = useProductTheme()
  const canSend = value.trim().length > 0 && !disabled

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.border,
          backgroundColor: theme.background,
          paddingTop: PlayTTSpacing.xs,
          paddingBottom: bottomInset + PlayTTSpacing.xs,
          gap: PlayTTSpacing.xs,
        },
        chips: { gap: PlayTTSpacing.xs, paddingHorizontal: PlayTTSpacing.md },
        chip: {
          borderRadius: PlayTTRadius.pill,
          borderWidth: 1,
          borderColor: theme.border,
          paddingHorizontal: PlayTTSpacing.sm,
          paddingVertical: 6,
        },
        chipText: { fontFamily: PlayTTFontFamilies.medium, fontSize: 13, color: theme.foreground },
        row: { flexDirection: "row", alignItems: "flex-end", gap: PlayTTSpacing.xs, paddingHorizontal: PlayTTSpacing.md },
        plus: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.elevated,
        },
        inputWrap: {
          flex: 1,
          minHeight: 40,
          maxHeight: 110,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.card,
          paddingHorizontal: PlayTTSpacing.sm,
          paddingVertical: PlayTTSpacing.xs,
          justifyContent: "center",
        },
        input: {
          fontSize: 15,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.foreground,
          lineHeight: 20,
          paddingVertical: 0,
        },
        send: {
          minWidth: 56,
          height: 40,
          borderRadius: PlayTTRadius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: canSend ? PlayTTColors.primary : theme.elevated,
        },
        sendLabel: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: canSend ? PlayTTColors.primaryForeground : theme.muted,
        },
        disabled: {
          fontFamily: PlayTTFontFamilies.regular,
          fontSize: 13,
          color: theme.muted,
          textAlign: "center",
          paddingHorizontal: PlayTTSpacing.lg,
          paddingVertical: PlayTTSpacing.xs,
        },
      }),
    [bottomInset, canSend, theme],
  )

  if (disabled && disabledReason) {
    return (
      <View style={styles.root}>
        <Text style={styles.disabled}>{disabledReason}</Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
        {QUICK_REPLIES.map((reply) => (
          <Pressable
            key={reply}
            accessibilityRole="button"
            accessibilityLabel={`Send quick reply: ${reply}`}
            disabled={disabled}
            onPress={() => onQuickReply(reply)}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{reply}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.row}>
        {showActions ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Book or share a table"
            disabled={disabled}
            onPress={onOpenActions}
            style={styles.plus}
          >
            <Plus size={20} color={theme.foreground} weight="bold" />
          </Pressable>
        ) : null}
        <View style={styles.inputWrap}>
          <TextInput
            value={value}
            onChangeText={(text) => onChange(text.slice(0, MESSAGE_MAX))}
            placeholder="Message"
            placeholderTextColor={theme.muted}
            style={styles.input}
            multiline
            maxLength={MESSAGE_MAX}
            editable={!disabled}
            accessibilityLabel="Message"
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          disabled={!canSend}
          onPress={onSend}
          style={styles.send}
        >
          <Text style={styles.sendLabel}>Send</Text>
        </Pressable>
      </View>
    </View>
  )
}
