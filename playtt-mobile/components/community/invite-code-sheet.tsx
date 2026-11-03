import { useState } from "react"
import { StyleSheet, TextInput, View } from "react-native"

import { Button } from "@/components/kit/button"
import { Sheet } from "@/components/kit/sheet"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { normalizeInviteCode } from "@/lib/community-invite"

type InviteCodeSheetProps = {
  visible: boolean
  onClose: () => void
  onSubmit: (code: string) => Promise<void>
}

// The parent remounts this (via `key`) each time it opens.
export function InviteCodeSheet({ visible, onClose, onSubmit }: InviteCodeSheetProps) {
  const { colors, scheme } = useAppTheme()
  const [value, setValue] = useState("")
  const [saving, setSaving] = useState(false)
  const code = normalizeInviteCode(value)

  async function submit() {
    if (!code || saving) return
    setSaving(true)
    try {
      await onSubmit(code)
    } finally {
      setSaving(false)
    }
  }

  return (
    // The kit sheet rises above the keyboard, so the code stays in view as you type.
    <Sheet visible={visible} title="Have an invite code?" detents={["content"]} scrollable onClose={onClose}>
      <View style={styles.body}>
        <AppText variant="subheadline" color="secondaryLabel">
          Enter the 8-character code from your friend&apos;s invite. You&apos;ll follow each other and a chat opens.
        </AppText>
        <TextInput
          value={value}
          onChangeText={(text) => setValue(text.replace(/\s/g, "").toUpperCase().slice(0, 12))}
          placeholder="K7QM2XHP"
          placeholderTextColor={colors.tertiaryLabel}
          selectionColor={colors.accent}
          style={[styles.input, { color: colors.label, backgroundColor: colors.fill }]}
          autoFocus
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          textContentType="oneTimeCode"
          keyboardAppearance={scheme === "dark" ? "dark" : "light"}
          returnKeyType="go"
          enablesReturnKeyAutomatically
          onSubmitEditing={() => void submit()}
          maxFontSizeMultiplier={1.3}
          accessibilityLabel="Invite code"
        />
        <Button label="Use code" disabled={!code || saving} loading={saving} onPress={() => void submit()} />
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: PlayTTSpacing.md },
  input: {
    minHeight: 64,
    borderRadius: 18,
    borderCurve: "continuous",
    textAlign: "center",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 4,
    fontVariant: ["tabular-nums"],
    paddingVertical: 0,
    paddingHorizontal: PlayTTSpacing.md,
  },
})
