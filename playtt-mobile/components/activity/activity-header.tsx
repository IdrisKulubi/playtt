import { useMemo } from "react"
import { Text, View } from "react-native"

import { createActivityHeaderStyles } from "@/components/activity/activity-screen-styles"
import { PreviewBadge } from "@/components/ui/preview-badge"
import { useProductTheme } from "@/hooks/use-product-theme"

type ActivitySegment = "highlights" | "stats"

type ActivityHeaderProps = {
  segment: ActivitySegment
}

const INTRO_COPY: Record<ActivitySegment, string> = {
  highlights: "Clips from your sessions",
  stats: "Your time on the table",
}

export function ActivityHeader({ segment }: ActivityHeaderProps) {
  const theme = useProductTheme()
  const styles = useMemo(() => createActivityHeaderStyles(theme), [theme])

  return (
    <View style={styles.band}>
      <View style={styles.topRow}>
        <Text style={styles.intro}>{INTRO_COPY[segment]}</Text>
        <PreviewBadge label="Sample" />
      </View>
    </View>
  )
}
