import * as Haptics from "expo-haptics"
import { useMemo, useState } from "react"
import { Pressable, StyleSheet, Switch, Text, View } from "react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PlayTTColors, PlayTTFontFamilies, PlayTTRadius, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { goOpenToPlay, stopOpenToPlay } from "@/lib/community-api"
import type { CommunityMe, PlayAvailabilityWindow } from "@/lib/community-types"
import { toast } from "@/lib/toast"

import { formatNairobiClock } from "./player-card/card-tiers"

const NOTE_MAX = 80

const WINDOWS: { value: PlayAvailabilityWindow; title: string; detail: string }[] = [
  { value: "now", title: "Now", detail: "Next 2 hours" },
  { value: "today", title: "Today", detail: "Until midnight" },
  { value: "tonight", title: "Tonight", detail: "5 PM – 11 PM" },
  { value: "weekend", title: "This weekend", detail: "Sat & Sun" },
]

/** "Tonight" is rejected by the API after 23:00 Nairobi time. */
export function tonightHasPassed(now = new Date()) {
  const nairobiHour = new Date(now.getTime() + 3 * 60 * 60 * 1000).getUTCHours()
  return nairobiHour >= 23
}

type OpenToPlaySheetProps = {
  visible: boolean
  me: CommunityMe
  onClose: () => void
  onChanged: (me: CommunityMe, wentOpen: boolean) => void
}

export function OpenToPlaySheet({ visible, me, onClose, onChanged }: OpenToPlaySheetProps) {
  const theme = useProductTheme()
  // The parent remounts this sheet (via `key`) each time it opens, so the
  // form starts from the current status.
  const current = me.availability
  const [selectedWindow, setSelectedWindow] = useState<PlayAvailabilityWindow>(current?.window ?? "now")
  const [note, setNote] = useState(current?.note ?? "")
  const [doubles, setDoubles] = useState(current?.lookingForDoubles ?? false)
  const [saving, setSaving] = useState<"open" | "stop" | null>(null)
  const tonightDisabled = tonightHasPassed()

  async function goOpen() {
    setSaving("open")
    try {
      const next = await goOpenToPlay({
        window: selectedWindow,
        note: note.trim() ? note.trim() : null,
        lookingForDoubles: doubles,
      })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
      onChanged(next, true)
      onClose()
    } catch (error) {
      toast.apiError(error, "Could not set you as open to play.")
    } finally {
      setSaving(null)
    }
  }

  async function stop() {
    setSaving("stop")
    try {
      onChanged(await stopOpenToPlay(), false)
      onClose()
    } catch (error) {
      toast.apiError(error, "Could not update your status.")
    } finally {
      setSaving(null)
    }
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: { gap: PlayTTSpacing.md },
        grid: { flexDirection: "row", flexWrap: "wrap", gap: PlayTTSpacing.xs },
        chip: {
          width: "48.5%",
          borderRadius: PlayTTRadius.lg,
          borderWidth: 1.5,
          borderColor: theme.border,
          backgroundColor: theme.elevated,
          paddingVertical: PlayTTSpacing.sm,
          paddingHorizontal: PlayTTSpacing.sm,
          gap: 2,
        },
        chipActive: {
          borderColor: PlayTTColors.primary,
          backgroundColor: "rgba(0, 183, 255, 0.12)",
        },
        chipDisabled: { opacity: 0.4 },
        chipTitle: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 16, color: theme.foreground },
        chipDetail: { fontFamily: PlayTTFontFamilies.regular, fontSize: 13, color: theme.muted },
        label: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 14, color: theme.foreground },
        counter: { fontFamily: PlayTTFontFamilies.regular, fontSize: 12, color: theme.muted, textAlign: "right" },
        row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: PlayTTSpacing.md },
        rowCopy: { flex: 1, gap: 2 },
        hint: { fontFamily: PlayTTFontFamilies.regular, fontSize: 13, color: theme.muted, lineHeight: 18 },
      }),
    [theme],
  )

  return (
    <BottomSheet visible={visible} title="Open to play" onClose={onClose} scrollable>
      <View style={styles.body}>
        {current ? (
          <Text style={styles.hint}>
            You&apos;re open until {formatNairobiClock(current.endsAt)}. Change it below or stop.
          </Text>
        ) : (
          <Text style={styles.hint}>
            Players at your venue will see you. Agree a time in chat, then book a table as usual.
          </Text>
        )}

        <View style={styles.grid} accessibilityRole="radiogroup">
          {WINDOWS.map((option) => {
            const disabled = option.value === "tonight" && tonightDisabled
            const active = selectedWindow === option.value
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: active, disabled }}
                disabled={disabled}
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => undefined)
                  setSelectedWindow(option.value)
                }}
                style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
              >
                <Text style={styles.chipTitle}>{option.title}</Text>
                <Text style={styles.chipDetail}>{disabled ? "Over for today" : option.detail}</Text>
              </Pressable>
            )
          })}
        </View>

        <View style={{ gap: PlayTTSpacing["2xs"] }}>
          <Text style={styles.label}>Note (optional)</Text>
          <Input
            value={note}
            onChangeText={(value) => setNote(value.slice(0, NOTE_MAX))}
            placeholder="e.g. Up for a few sets after work"
            maxLength={NOTE_MAX}
            returnKeyType="done"
          />
          <Text style={styles.counter}>
            {note.length}/{NOTE_MAX}
          </Text>
        </View>

        <View style={styles.row}>
          <View style={styles.rowCopy}>
            <Text style={styles.label}>Looking for doubles</Text>
            <Text style={styles.hint}>Show a 2v2 tag on your card.</Text>
          </View>
          <Switch
            value={doubles}
            onValueChange={setDoubles}
            accessibilityLabel="Looking for doubles"
            trackColor={{ true: PlayTTColors.primary }}
          />
        </View>

        <Button
          label={current ? "Update" : "Go open"}
          surface="product"
          productTheme={theme}
          loading={saving === "open"}
          disabled={saving !== null}
          onPress={goOpen}
        />
        {current ? (
          <Button
            label="Stop being open"
            variant="outline"
            surface="product"
            productTheme={theme}
            loading={saving === "stop"}
            disabled={saving !== null}
            onPress={stop}
          />
        ) : null}
      </View>
    </BottomSheet>
  )
}
