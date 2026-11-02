import { Plus } from "phosphor-react-native/src/icons/Plus"
import { ScrollView, StyleSheet, TextInput, View } from "react-native"

import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { typeStyle } from "@/constants/type"
import { useAppTheme } from "@/hooks/use-app-theme"
import { QUICK_REPLIES } from "@/lib/community-types"

const MESSAGE_MAX = 1000
const BODY = typeStyle("body")

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

/**
 * Quick replies, a 17 pt message field, and a Send button that says "Send".
 * Same shape as components/coach/coach-chat-composer.tsx plus booking actions.
 */
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
  const { colors } = useAppTheme()
  const canSend = value.trim().length > 0 && !disabled
  const rootStyle = [
    styles.root,
    { borderTopColor: colors.separator, backgroundColor: colors.background, paddingBottom: bottomInset + PlayTTSpacing.xs },
  ]

  if (disabled && disabledReason) {
    return (
      <View style={rootStyle}>
        <AppText variant="callout" color="secondaryLabel" style={styles.disabled}>
          {disabledReason}
        </AppText>
      </View>
    )
  }

  return (
    <View style={rootStyle}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        keyboardShouldPersistTaps="handled"
      >
        {QUICK_REPLIES.map((reply) => (
          <PressableScale
            key={reply}
            accessibilityLabel={`Send quick reply: ${reply}`}
            disabled={disabled}
            onPress={() => onQuickReply(reply)}
            style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.separator }]}
          >
            <AppText variant="subheadline" weight="500">
              {reply}
            </AppText>
          </PressableScale>
        ))}
      </ScrollView>
      <View style={styles.row}>
        {showActions ? (
          <PressableScale
            accessibilityLabel="Book or share a table"
            disabled={disabled}
            haptic="commit"
            onPress={onOpenActions}
            style={[styles.round, { backgroundColor: colors.fill }]}
          >
            <Plus size={22} color={colors.accentText} weight="bold" />
          </PressableScale>
        ) : null}
        <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.separator }]}>
          <TextInput
            value={value}
            onChangeText={(text) => onChange(text.slice(0, MESSAGE_MAX))}
            placeholder="Message"
            placeholderTextColor={colors.tertiaryLabel}
            style={[styles.input, { color: colors.label }]}
            multiline
            maxLength={MESSAGE_MAX}
            editable={!disabled}
            accessibilityLabel="Message"
          />
        </View>
        <PressableScale
          accessibilityLabel="Send message"
          disabled={!canSend}
          haptic="commit"
          onPress={onSend}
          style={[styles.send, { backgroundColor: canSend ? colors.accent : colors.fill }]}
        >
          <AppText variant="headline" color={canSend ? "onAccent" : "secondaryLabel"}>
            Send
          </AppText>
        </PressableScale>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: PlayTTSpacing.xs, gap: PlayTTSpacing.xs },
  chips: { gap: PlayTTSpacing.xs, paddingHorizontal: PlayTTSpacing.md },
  chip: { borderRadius: 24, borderWidth: 1, paddingHorizontal: PlayTTSpacing.md, justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "flex-end", gap: PlayTTSpacing.xs, paddingHorizontal: PlayTTSpacing.md },
  round: {
    width: KitLayout.minTouchTarget,
    height: KitLayout.minTouchTarget,
    borderRadius: KitLayout.minTouchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrap: {
    flex: 1,
    minHeight: KitLayout.minTouchTarget,
    maxHeight: 132,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: PlayTTSpacing.md,
    paddingVertical: PlayTTSpacing.xs,
    justifyContent: "center",
  },
  input: { ...BODY, paddingVertical: 0 },
  send: {
    minWidth: 72,
    height: KitLayout.minTouchTarget,
    borderRadius: 24,
    paddingHorizontal: PlayTTSpacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { textAlign: "center", paddingHorizontal: PlayTTSpacing.lg, paddingVertical: PlayTTSpacing.xs },
})
