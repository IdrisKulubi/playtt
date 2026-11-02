import type { Href } from "expo-router"
import type { ReactNode } from "react"
import { StyleSheet, View } from "react-native"

import { StackHeader } from "@/components/kit/stack-header"
import { PlayTTSpacing } from "@/constants/playtt-tokens"

const PLAYERS_HREF = "/(app)/(tabs)/community" as Href

type CommunityScreenHeaderProps = {
  title: string
  trailing?: ReactNode
  /** Names where back goes; "Back" when the screen can be reached from many places. */
  backLabel?: string
}

/** Pushed Players screens: back button that names where it goes, large title, optional action. */
export function CommunityScreenHeader({ title, trailing, backLabel = "Back" }: CommunityScreenHeaderProps) {
  return (
    <View style={styles.root}>
      <StackHeader title={title} backLabel={backLabel} fallbackHref={PLAYERS_HREF} trailing={trailing} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { paddingBottom: PlayTTSpacing.sm },
})
