import { StyleSheet, View } from "react-native"

import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"

type IncomingRequestBannerProps = {
  name: string
  busy: boolean
  onAccept: () => void
  onDelete: () => void
  onBlockAndReport: () => void
}

/** Shown to the recipient of a message request: accept is the clear main action. */
export function IncomingRequestBanner({ name, busy, onAccept, onDelete, onBlockAndReport }: IncomingRequestBannerProps) {
  return (
    <View style={styles.wrap}>
      <Card>
        <View style={styles.stack}>
          <AppText variant="headline">{name} wants to play</AppText>
          <AppText variant="callout" color="secondaryLabel">
            You don&apos;t follow {name} yet. Accept to move this chat to your inbox. They won&apos;t know you&apos;ve
            seen it until you reply or accept.
          </AppText>
          <Button label="Accept" disabled={busy} onPress={onAccept} style={styles.accept} />
          <View style={styles.row}>
            <Button label="Delete" variant="secondary" disabled={busy} onPress={onDelete} style={styles.half} />
            <Button
              label="Block and report"
              variant="destructive"
              disabled={busy}
              onPress={onBlockAndReport}
              style={styles.half}
            />
          </View>
        </View>
      </Card>
    </View>
  )
}

/** Shown to the sender while the other player hasn't accepted. */
export function PendingRequestNote({ name, remaining }: { name: string; remaining: number }) {
  return (
    <AppText variant="footnote" color="secondaryLabel" style={styles.note} accessibilityLiveRegion="polite">
      {remaining > 0
        ? `Message request sent. You can send ${remaining} more until ${name} accepts.`
        : `Waiting for ${name} to accept your request.`}
    </AppText>
  )
}

const styles = StyleSheet.create({
  wrap: { margin: PlayTTSpacing.md },
  stack: { gap: PlayTTSpacing.xs },
  accept: { marginTop: PlayTTSpacing.sm },
  row: { flexDirection: "row", flexWrap: "wrap", gap: PlayTTSpacing.xs },
  half: { flexGrow: 1, flexBasis: 140 },
  note: { textAlign: "center", paddingHorizontal: PlayTTSpacing.lg, paddingVertical: PlayTTSpacing.xs },
})
