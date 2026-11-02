import { StyleSheet, View } from "react-native"

import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { formatKes } from "@/lib/booking-utils"
import type { CoachStatus } from "@/lib/coach-types"

type CoachSubscriptionBandProps = {
  status: CoachStatus
  onSubscribe: () => void
}

/** Price and one clear button, shown until Coach is on. */
export function CoachSubscriptionBand({ status, onSubscribe }: CoachSubscriptionBandProps) {
  if (status.isActive) return null

  return (
    <Card>
      <View style={styles.stack}>
        <AppText variant="headline">Get Coach</AppText>
        <AppText variant="title2" tabular>
          {formatKes(status.monthlyPriceKes)}{" "}
          <AppText variant="callout" color="secondaryLabel">
            a month
          </AppText>
        </AppText>
        <Button label="Start Coach" onPress={onSubscribe} style={styles.cta} />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.xs },
  cta: { marginTop: PlayTTSpacing.sm },
})
