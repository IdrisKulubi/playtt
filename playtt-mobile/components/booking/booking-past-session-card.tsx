import { StyleSheet, View } from "react-native"

import { Card } from "@/components/kit/card"
import { AppText } from "@/components/ui/app-text"
import { PreviewBadge } from "@/components/ui/preview-badge"
import { PlayTTSpacing } from "@/constants/playtt-tokens"

export function BookingPastSessionCard() {
  return (
    <Card>
      <View style={styles.stack}>
        <View style={styles.header}>
          <AppText variant="headline">Replays from this game</AppText>
          <PreviewBadge label="Sample" />
        </View>
        <AppText variant="callout" color="secondaryLabel">
          Replays from your games show up in Progress once the venue cameras are connected.
        </AppText>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.xs },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: PlayTTSpacing.sm },
})
