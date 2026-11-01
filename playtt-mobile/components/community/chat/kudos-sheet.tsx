import * as Haptics from "expo-haptics"
import { useMemo, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { PlayTTColors, PlayTTFontFamilies, PlayTTRadius, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { giveKudos } from "@/lib/community-api"
import {
  KUDOS_EMOJI,
  KUDOS_LABELS,
  KUDOS_TYPES,
  MAX_KUDOS_PER_MATCH,
  type CommunitySharedBooking,
  type KudosType,
} from "@/lib/community-types"
import { toast } from "@/lib/toast"

type KudosSheetProps = {
  visible: boolean
  booking: CommunitySharedBooking
  receiverId: string
  receiverName: string
  onClose: () => void
  onGiven: (bookings: CommunitySharedBooking[]) => void
}

// The parent remounts this (via `key`) each time it opens.
export function KudosSheet({ visible, booking, receiverId, receiverName, onClose, onGiven }: KudosSheetProps) {
  const theme = useProductTheme()
  const given = booking.kudosGiven[receiverId] ?? []
  const [picked, setPicked] = useState<KudosType[]>([])
  const [saving, setSaving] = useState(false)
  const remaining = MAX_KUDOS_PER_MATCH - given.length - picked.length

  function toggle(type: KudosType) {
    if (given.includes(type)) return
    void Haptics.selectionAsync().catch(() => undefined)
    setPicked((current) =>
      current.includes(type) ? current.filter((value) => value !== type) : remaining > 0 ? [...current, type] : current,
    )
  }

  async function submit() {
    if (picked.length === 0) return
    setSaving(true)
    try {
      onGiven(await giveKudos(booking.bookingId, receiverId, picked))
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
      toast.success(`Kudos sent to ${receiverName} 🏓`)
      onClose()
    } catch (error) {
      toast.apiError(error, "Could not send kudos.")
    } finally {
      setSaving(false)
    }
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: { gap: PlayTTSpacing.md },
        hint: { fontFamily: PlayTTFontFamilies.regular, fontSize: 14, color: theme.muted, lineHeight: 20 },
        grid: { flexDirection: "row", flexWrap: "wrap", gap: PlayTTSpacing.xs },
        option: {
          width: "48.5%",
          borderRadius: PlayTTRadius.lg,
          borderWidth: 1.5,
          borderColor: theme.border,
          paddingVertical: PlayTTSpacing.sm,
          paddingHorizontal: PlayTTSpacing.sm,
          gap: 2,
        },
        optionActive: { borderColor: PlayTTColors.primary, backgroundColor: "rgba(0, 183, 255, 0.12)" },
        optionGiven: { opacity: 0.55 },
        emoji: { fontSize: 22 },
        label: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 14, color: theme.foreground },
        sub: { fontFamily: PlayTTFontFamilies.regular, fontSize: 12, color: theme.muted },
      }),
    [theme],
  )

  if (!booking.kudosOpen) {
    return (
      <BottomSheet visible={visible} title="Give kudos" onClose={onClose}>
        <Text style={styles.hint}>Kudos open when your match ends and stay open for 72 hours.</Text>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet visible={visible} title={`Kudos for ${receiverName}`} onClose={onClose} scrollable>
      <View style={styles.body}>
        <Text style={styles.hint}>
          Pick up to {MAX_KUDOS_PER_MATCH}. Kudos are positive only; if something went wrong, use Report instead.
        </Text>
        <View style={styles.grid} accessibilityRole="list">
          {KUDOS_TYPES.map((type) => {
            const isGiven = given.includes(type)
            const active = isGiven || picked.includes(type)
            return (
              <Pressable
                key={type}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active, disabled: isGiven }}
                accessibilityLabel={KUDOS_LABELS[type]}
                disabled={isGiven}
                onPress={() => toggle(type)}
                style={[styles.option, active && styles.optionActive, isGiven && styles.optionGiven]}
              >
                <Text style={styles.emoji}>{KUDOS_EMOJI[type]}</Text>
                <Text style={styles.label}>{KUDOS_LABELS[type]}</Text>
                {isGiven ? <Text style={styles.sub}>Sent</Text> : null}
              </Pressable>
            )
          })}
        </View>
        <Button
          label={picked.length > 0 ? `Send ${picked.length} kudos` : "Pick kudos"}
          surface="product"
          productTheme={theme}
          disabled={picked.length === 0 || saving}
          loading={saving}
          onPress={submit}
        />
      </View>
    </BottomSheet>
  )
}
