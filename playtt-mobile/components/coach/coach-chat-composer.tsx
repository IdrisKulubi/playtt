import { ActivityIndicator, StyleSheet, TextInput, View } from "react-native"

import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { typeStyle } from "@/constants/type"
import { useAppTheme } from "@/hooks/use-app-theme"

const BODY = typeStyle("body")

type CoachChatComposerProps = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled?: boolean
  isSending?: boolean
}

/** Same shape as the player chat composer: 17 pt field, a Send button that says "Send". */
export function CoachChatComposer({ value, onChange, onSend, disabled = false, isSending = false }: CoachChatComposerProps) {
  const { colors } = useAppTheme()
  const canSend = value.trim().length > 0 && !disabled && !isSending

  return (
    <View style={[styles.root, { borderTopColor: colors.separator, backgroundColor: colors.background }]}>
      <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.separator }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Ask your coach…"
          placeholderTextColor={colors.tertiaryLabel}
          style={[styles.input, { color: colors.label }]}
          multiline
          editable={!disabled && !isSending}
          returnKeyType="send"
          accessibilityLabel="Message to Coach"
          onSubmitEditing={() => {
            if (canSend) onSend()
          }}
        />
      </View>
      <PressableScale
        accessibilityLabel="Send message"
        accessibilityState={{ busy: isSending }}
        disabled={!canSend}
        haptic="commit"
        onPress={onSend}
        style={[styles.send, { backgroundColor: canSend ? colors.accent : colors.fill }]}
      >
        {isSending ? (
          <ActivityIndicator color={colors.secondaryLabel} />
        ) : (
          <AppText variant="headline" color={canSend ? "onAccent" : "secondaryLabel"}>
            Send
          </AppText>
        )}
      </PressableScale>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: PlayTTSpacing.xs,
    paddingHorizontal: KitLayout.screenGutter,
    paddingTop: PlayTTSpacing.xs,
    paddingBottom: PlayTTSpacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
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
})
