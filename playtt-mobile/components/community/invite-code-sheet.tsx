import { useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { normalizeInviteCode } from "@/lib/community-invite"

type InviteCodeSheetProps = {
  visible: boolean
  onClose: () => void
  onSubmit: (code: string) => Promise<void>
}

// The parent remounts this (via `key`) each time it opens.
export function InviteCodeSheet({ visible, onClose, onSubmit }: InviteCodeSheetProps) {
  const theme = useProductTheme()
  const [value, setValue] = useState("")
  const [saving, setSaving] = useState(false)
  const code = normalizeInviteCode(value)

  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: { gap: PlayTTSpacing.md },
        hint: { fontFamily: PlayTTFontFamilies.regular, fontSize: 14, color: theme.muted, lineHeight: 20 },
      }),
    [theme],
  )

  return (
    <BottomSheet visible={visible} title="Have an invite code?" onClose={onClose}>
      <View style={styles.body}>
        <Text style={styles.hint}>
          Enter the 8-character code from your friend&apos;s invite. You&apos;ll follow each other and a chat opens.
        </Text>
        <Input
          value={value}
          onChangeText={(text) => setValue(text.toUpperCase().slice(0, 12))}
          placeholder="e.g. K7QM2XHP"
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="Invite code"
        />
        <Button
          label="Use code"
          surface="product"
          productTheme={theme}
          disabled={!code || saving}
          loading={saving}
          onPress={async () => {
            if (!code) return
            setSaving(true)
            try {
              await onSubmit(code)
            } finally {
              setSaving(false)
            }
          }}
        />
      </View>
    </BottomSheet>
  )
}
