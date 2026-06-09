import { useMemo } from "react"
import { Text, View } from "react-native"

import { createBookingProgressStyles } from "@/components/booking/booking-theme"
import { useProductTheme } from "@/hooks/use-product-theme"

type BookingProgressStep = "when" | "players" | "done"

type BookingProgressProps = {
  activeStep: BookingProgressStep
}

const STEPS: { id: BookingProgressStep; label: string }[] = [
  { id: "when", label: "When" },
  { id: "players", label: "Players" },
  { id: "done", label: "Done" },
]

export function BookingProgress({ activeStep }: BookingProgressProps) {
  const theme = useProductTheme()
  const styles = useMemo(() => createBookingProgressStyles(theme), [theme])
  const activeIndex = STEPS.findIndex((step) => step.id === activeStep)

  return (
    <View style={styles.row}>
      {STEPS.map((step, index) => {
        const isActive = index === activeIndex
        const isComplete = index < activeIndex

        return (
          <View key={step.id} style={styles.item}>
            <View
              style={[
                styles.dot,
                (isActive || isComplete) && styles.dotActive,
              ]}
            />
            <Text
              style={[
                styles.label,
                (isActive || isComplete) && styles.labelActive,
              ]}
            >
              {step.label}
            </Text>
          </View>
        )
      })}
    </View>
  )
}
