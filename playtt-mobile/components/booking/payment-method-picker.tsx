import { Pressable, StyleSheet, Text, View } from "react-native"

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import type { ProductThemeColors } from "@/constants/product-theme"
import type { PaymentMethodChoice } from "@/lib/booking-types"

type PaymentMethodPickerProps = {
  value: PaymentMethodChoice
  onChange: (method: PaymentMethodChoice) => void
  theme: ProductThemeColors
  disabled?: boolean
}

const OPTIONS: { id: PaymentMethodChoice; label: string; description: string }[] =
  [
    {
      id: "mpesa",
      label: "M-Pesa",
      description: "STK push to your phone",
    },
    {
      id: "card",
      label: "Card",
      description: "Visa, Mastercard, Amex",
    },
  ]

export function PaymentMethodPicker({
  value,
  onChange,
  theme,
  disabled = false,
}: PaymentMethodPickerProps) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const selected = value === option.id

        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.id)}
            style={[
              styles.option,
              {
                borderColor: selected ? PlayTTColors.primary : theme.border,
                backgroundColor: selected ? theme.card : theme.background,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: selected ? theme.foreground : theme.muted },
              ]}
            >
              {option.label}
            </Text>
            <Text style={[styles.description, { color: theme.muted }]}>
              {option.description}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: PlayTTSpacing.sm,
    marginTop: PlayTTSpacing.md,
  },
  option: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: PlayTTSpacing.md,
    gap: PlayTTSpacing.xs,
  },
  label: {
    fontSize: 15,
    fontFamily: PlayTTFontFamilies.semiBold,
  },
  description: {
    fontSize: 12,
    fontFamily: PlayTTFontFamilies.regular,
    lineHeight: 16,
  },
})
