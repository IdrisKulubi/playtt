import { useState } from "react"
import { StyleSheet, View } from "react-native"

import { Button } from "@/components/kit/button"
import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { giveKudos } from "@/lib/community-api"
import {
  KUDOS_EMOJI,
  KUDOS_LABELS,
  KUDOS_TYPES,
  MAX_KUDOS_PER_MATCH,
  type CommunitySharedBooking,
  type KudosType,
} from "@/lib/community-types"
import { haptics } from "@/lib/haptics"
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
  const { colors } = useAppTheme()
  const given = booking.kudosGiven[receiverId] ?? []
  const [picked, setPicked] = useState<KudosType[]>([])
  const [saving, setSaving] = useState(false)
  const remaining = MAX_KUDOS_PER_MATCH - given.length - picked.length

  function toggle(type: KudosType) {
    if (given.includes(type)) return
    setPicked((current) =>
      current.includes(type) ? current.filter((value) => value !== type) : remaining > 0 ? [...current, type] : current,
    )
  }

  async function submit() {
    if (picked.length === 0) return
    setSaving(true)
    try {
      onGiven(await giveKudos(booking.bookingId, receiverId, picked))
      haptics.success()
      toast.success(`Kudos sent to ${receiverName} 🏓`)
      onClose()
    } catch (error) {
      toast.apiError(error, "Could not send kudos.")
    } finally {
      setSaving(false)
    }
  }

  if (!booking.kudosOpen) {
    return (
      <BottomSheet visible={visible} title="Give kudos" onClose={onClose}>
        <AppText variant="body" color="secondaryLabel">
          You can give kudos once your match ends, for up to 3 days afterwards.
        </AppText>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet visible={visible} title={`Kudos for ${receiverName}`} onClose={onClose} scrollable>
      <View style={styles.body}>
        <AppText variant="body" color="secondaryLabel">
          Pick up to {MAX_KUDOS_PER_MATCH}. Kudos are for good things only; if something went wrong, use Report instead.
        </AppText>
        <View style={styles.grid} accessibilityRole="list">
          {KUDOS_TYPES.map((type) => {
            const isGiven = given.includes(type)
            const active = isGiven || picked.includes(type)
            return (
              <PressableScale
                key={type}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active, disabled: isGiven }}
                accessibilityLabel={KUDOS_LABELS[type]}
                haptic="selection"
                disabled={isGiven}
                pressedScale={0.97}
                onPress={() => toggle(type)}
                style={[
                  styles.option,
                  {
                    borderColor: active ? colors.accent : colors.separator,
                    backgroundColor: active ? colors.fill : colors.surface,
                  },
                ]}
              >
                <View style={styles.optionTop}>
                  <AppText variant="title2">{KUDOS_EMOJI[type]}</AppText>
                  {active ? <IconSymbol name="checkmark.circle.fill" size={20} color={colors.accentText} /> : null}
                </View>
                <AppText variant="headline">{KUDOS_LABELS[type]}</AppText>
                {isGiven ? (
                  <AppText variant="footnote" color="secondaryLabel">
                    Sent
                  </AppText>
                ) : null}
              </PressableScale>
            )
          })}
        </View>
        <Button
          label={picked.length > 0 ? `Send ${picked.length} kudos` : "Pick kudos"}
          disabled={picked.length === 0 || saving}
          loading={saving}
          onPress={submit}
        />
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: PlayTTSpacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: PlayTTSpacing.xs },
  option: {
    flexGrow: 1,
    flexBasis: "45%",
    borderRadius: 14,
    borderWidth: 1.5,
    padding: PlayTTSpacing.sm,
    gap: 2,
  },
  optionTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
})
