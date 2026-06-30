import { useMemo } from "react"
import { Pressable, Text, View } from "react-native"

import { createGroupSizeSheetStyles } from "@/components/booking/booking-theme"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { useProductTheme } from "@/hooks/use-product-theme"
import { GROUP_SIZE_OPTIONS, type GroupSize } from "@/lib/booking-types"
import {
  EXTRA_PLAYER_SURCHARGE,
  INCLUDED_PLAYERS,
  extraPlayerSurcharge,
  formatKes,
} from "@/lib/booking-utils"

type GroupSizeSheetProps = {
  visible: boolean
  groupSize: GroupSize
  currency: string
  onClose: () => void
  onGroupSizeChange: (size: GroupSize) => void
  onContinue: () => void
  loading?: boolean
  /** Edit mode: optionally limit the smallest visible group size. */
  minGroupSize?: GroupSize
  title?: string
  continueLabel?: string
  hint?: string
}

export function GroupSizeSheet({
  visible,
  groupSize,
  currency,
  onClose,
  onGroupSizeChange,
  onContinue,
  loading = false,
  minGroupSize,
  title = "How many of you?",
  continueLabel = "Continue",
  hint,
}: GroupSizeSheetProps) {
  const theme = useProductTheme()
  const styles = useMemo(() => createGroupSizeSheetStyles(theme), [theme])
  const sizeOptions = useMemo(
    () =>
      minGroupSize
        ? GROUP_SIZE_OPTIONS.filter((size) => size >= minGroupSize)
        : GROUP_SIZE_OPTIONS,
    [minGroupSize]
  )

  const defaultHint = `Base rate includes up to ${INCLUDED_PLAYERS} players. Extra players are ${formatKes(EXTRA_PLAYER_SURCHARGE, currency)} each.`

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <View style={styles.list}>
        {sizeOptions.map((size) => {
          const active = size === groupSize
          const surcharge = extraPlayerSurcharge(size)

          return (
            <Pressable
              key={size}
              onPress={() => onGroupSizeChange(size)}
              style={[styles.row, active && styles.rowActive]}
            >
              <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>
                {size} players
              </Text>
              <Text style={[styles.rowMeta, active && styles.rowMetaActive]}>
                {surcharge > 0
                  ? `+${formatKes(surcharge, currency)}`
                  : "Included"}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <Text style={styles.hint}>{hint ?? defaultHint}</Text>

      <Button
        label={continueLabel}
        surface="product"
        productTheme={theme}
        onPress={onContinue}
        loading={loading}
      />
    </BottomSheet>
  )
}
