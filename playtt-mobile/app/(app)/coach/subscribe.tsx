import { router } from "expo-router"
import { useState } from "react"
import { StyleSheet, View } from "react-native"

import { CoachSubscribeSheet } from "@/components/coach/coach-subscribe-sheet"
import { useAppTheme } from "@/hooks/use-app-theme"

/** Deep-link wrapper: opens the Start Coach sheet, then returns. */
export default function CoachSubscribeScreen() {
  const { colors } = useAppTheme()
  const [open, setOpen] = useState(true)

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <CoachSubscribeSheet
        visible={open}
        onClose={() => {
          setOpen(false)
          router.back()
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
