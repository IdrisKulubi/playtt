import { useMemo } from "react"
import { Pressable, Text, View } from "react-native"

import { createGroupSizeSheetStyles } from "@/components/booking/booking-theme"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { useProductTheme } from "@/hooks/use-product-theme"
import {
  GROUP_SIZE_OPTIONS,
  type GroupSize,
} from "@/lib/booking-types"
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
}

export function GroupSizeSheet({
  visible,
  groupSize,
  currency,
  onClose,
  onGroupSizeChange,
  onContinue,
  loading = false,
}: GroupSizeSheetProps) {
  const theme = useProductTheme()
  const styles = useMemo(() => createGroupSizeSheetStyles(theme), [theme])

  return (
    <BottomSheet visible={visible} title="How many of you?" onClose={onClose}>
      <View style={styles.list}>
        {GROUP_SIZE_OPTIONS.map((size) => {
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

      <Text style={styles.hint}>
        Base rate includes up to {INCLUDED_PLAYERS} players. Extra players are{" "}
        {formatKes(EXTRA_PLAYER_SURCHARGE, currency)} each.
      </Text>

      <Button
        label="Continue"
        surface="product"
        productTheme={theme}
        onPress={onContinue}
        loading={loading}
      />
    </BottomSheet>
  )
}
