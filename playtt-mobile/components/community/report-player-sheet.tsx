import { useMemo, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PlayTTRadius, PlayTTSpacing } from "@/constants/playtt-tokens"
import { typeStyle } from "@/constants/type"
import { useAppTheme } from "@/hooks/use-app-theme"
import { reportPlayer } from "@/lib/community-api"
import type { CommunityReportReason } from "@/lib/community-types"
import { toast } from "@/lib/toast"

const NOTE_MAX = 500

const REASONS: { value: CommunityReportReason; label: string }[] = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "inappropriate", label: "Inappropriate profile" },
  { value: "spam", label: "Spam or fake account" },
  { value: "no_show", label: "Didn't show up" },
  { value: "other", label: "Something else" },
]

type ReportPlayerSheetProps = {
  visible: boolean
  targetUserId: string
  displayName: string
  /** Set when reporting a specific chat message. */
  messageId?: string
  onClose: () => void
}

export function ReportPlayerSheet({ visible, targetUserId, displayName, messageId, onClose }: ReportPlayerSheetProps) {
  const { colors } = useAppTheme()
  const [reason, setReason] = useState<CommunityReportReason | null>(null)
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!reason) return
    setSaving(true)
    try {
      await reportPlayer({ targetUserId, reason, messageId, note: note.trim() || undefined })
      toast.success("Thanks. Our team will review this report.")
      onClose()
    } catch (error) {
      toast.apiError(error, "Could not send the report.")
    } finally {
      setSaving(false)
    }
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: { gap: PlayTTSpacing.sm },
        hint: { ...typeStyle("subheadline"), color: colors.secondaryLabel },
        option: {
          borderRadius: PlayTTRadius.lg,
          borderWidth: 1.5,
          borderColor: colors.separator,
          paddingVertical: PlayTTSpacing.sm,
          paddingHorizontal: PlayTTSpacing.md,
        },
        optionActive: { borderColor: colors.accentText, backgroundColor: "rgba(0, 183, 255, 0.10)" },
        optionLabel: { ...typeStyle("body", "500"), color: colors.label },
      }),
    [colors],
  )

  return (
    <BottomSheet visible={visible} title={messageId ? "Report message" : `Report ${displayName}`} onClose={onClose} scrollable>
      <View style={styles.body}>
        <Text style={styles.hint}>Reports are private. {displayName} won&apos;t know who sent it.</Text>
        <View style={{ gap: PlayTTSpacing.xs }} accessibilityRole="radiogroup">
          {REASONS.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: reason === option.value }}
              onPress={() => setReason(option.value)}
              style={[styles.option, reason === option.value && styles.optionActive]}
            >
              <Text style={styles.optionLabel}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        <Input
          value={note}
          onChangeText={(value) => setNote(value.slice(0, NOTE_MAX))}
          placeholder="Add details (optional)"
          maxLength={NOTE_MAX}
          multiline
        />
        <Button
          label="Send report"
          surface="product"
          disabled={!reason || saving}
          loading={saving}
          onPress={submit}
        />
      </View>
    </BottomSheet>
  )
}
