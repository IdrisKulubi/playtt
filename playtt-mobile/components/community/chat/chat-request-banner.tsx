import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { Button } from "@/components/ui/button"
import { PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

type IncomingRequestBannerProps = {
  name: string
  busy: boolean
  onAccept: () => void
  onDelete: () => void
  onBlockAndReport: () => void
}

/** Shown to the recipient of a message request. */
export function IncomingRequestBanner({ name, busy, onAccept, onDelete, onBlockAndReport }: IncomingRequestBannerProps) {
  const theme = useProductTheme()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          margin: PlayTTSpacing.md,
          padding: PlayTTSpacing.md,
          borderRadius: 16,
          backgroundColor: theme.elevated,
          gap: PlayTTSpacing.sm,
        },
        title: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 16, color: theme.foreground },
        detail: { fontFamily: PlayTTFontFamilies.regular, fontSize: 13, color: theme.muted, lineHeight: 18 },
        row: { flexDirection: "row", gap: PlayTTSpacing.xs },
        half: { flex: 1 },
      }),
    [theme],
  )

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{name} wants to play</Text>
      <Text style={styles.detail}>
        You don&apos;t follow {name} yet. Accept to move this chat to your inbox. They won&apos;t know you&apos;ve
        seen it until you reply or accept.
      </Text>
      <Button label="Accept" surface="product" productTheme={theme} disabled={busy} onPress={onAccept} />
      <View style={styles.row}>
        <View style={styles.half}>
          <Button label="Delete" variant="outline" surface="product" productTheme={theme} disabled={busy} onPress={onDelete} />
        </View>
        <View style={styles.half}>
          <Button
            label="Block & report"
            variant="outline"
            surface="product"
            productTheme={theme}
            disabled={busy}
            onPress={onBlockAndReport}
          />
        </View>
      </View>
    </View>
  )
}

/** Shown to the sender while the other player hasn't accepted. */
export function PendingRequestNote({ name, remaining }: { name: string; remaining: number }) {
  const theme = useProductTheme()
  return (
    <Text
      style={{
        fontFamily: PlayTTFontFamilies.regular,
        fontSize: 13,
        color: theme.muted,
        textAlign: "center",
        paddingHorizontal: PlayTTSpacing.lg,
        paddingVertical: PlayTTSpacing.xs,
        lineHeight: 18,
      }}
    >
      {remaining > 0
        ? `Message request sent. You can send ${remaining} more until ${name} accepts.`
        : `Waiting for ${name} to accept your request.`}
    </Text>
  )
}
