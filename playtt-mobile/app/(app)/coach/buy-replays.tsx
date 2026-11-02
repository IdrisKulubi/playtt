import { router } from "expo-router"
import { useState } from "react"
import { StyleSheet, View } from "react-native"

import { ClipPackPurchaseSheet } from "@/components/coach/clip-pack-purchase-sheet"
import { useAppTheme } from "@/hooks/use-app-theme"

/** Deep-link wrapper: opens the replay pack sheet, then returns. */
export default function BuyReplaysScreen() {
  const { colors } = useAppTheme()
  const [open, setOpen] = useState(true)

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ClipPackPurchaseSheet
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
