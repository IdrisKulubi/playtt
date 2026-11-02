import type { Href } from "expo-router"
import type { ReactNode } from "react"
import { StyleSheet, View } from "react-native"

import { BackButton } from "@/components/kit/back-button"
import { AppText } from "@/components/ui/app-text"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"

type StackHeaderProps = {
  title: string
  /** Names where back goes, e.g. "Progress". */
  backLabel: string
  /** Where to go when there's no screen to pop back to (deep links). */
  fallbackHref: Href
  /** Small labelled actions on the right of the back row. */
  trailing?: ReactNode
}

/**
 * Back button plus large title for pushed screens that own their scroll view
 * (and so can't use `<Screen>`). Place it inside the screen's scroll content.
 */
export function StackHeader({ title, backLabel, fallbackHref, trailing }: StackHeaderProps) {
  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <BackButton label={backLabel} fallbackHref={fallbackHref} />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      <AppText variant="largeTitle" accessibilityRole="header">
        {title}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: PlayTTSpacing["2xs"], paddingHorizontal: KitLayout.screenGutter },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: PlayTTSpacing.sm },
  trailing: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.xs },
})
