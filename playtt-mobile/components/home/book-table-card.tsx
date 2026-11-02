import { StyleSheet, View } from "react-native"

import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { PRIMARY_VENUE } from "@/lib/venue-assets"

type BookTableCardProps = {
  /** e.g. "From KES 1,600 per hour". */
  startingPriceLabel: string | null
  onBook: () => void
}

/** The Play tab's hero when nothing is booked: one clear next step. */
export function BookTableCard({ startingPriceLabel, onBook }: BookTableCardProps) {
  const { colors } = useAppTheme()

  return (
    <Card>
      <View style={styles.stack}>
        <View style={[styles.icon, { backgroundColor: colors.fill }]}>
          <IconSymbol name="figure.table.tennis" size={28} color={colors.accentText} />
        </View>
        <AppText variant="title2" accessibilityRole="header">
          Book a table
        </AppText>
        <AppText variant="body" color="secondaryLabel">
          Play at {PRIMARY_VENUE.name}. Pick a day and time, and we hold the table for you.
        </AppText>
        {startingPriceLabel ? (
          <AppText variant="headline" color="accentText">
            {startingPriceLabel}
          </AppText>
        ) : null}
        <Button label="Book a table" onPress={onBook} style={styles.cta} />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.xs },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: PlayTTSpacing.xs,
  },
  cta: { marginTop: PlayTTSpacing.sm },
})
