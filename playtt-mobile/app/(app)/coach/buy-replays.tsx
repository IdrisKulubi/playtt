import { router } from "expo-router"
import { useEffect, useState } from "react"
import { View } from "react-native"

import { ClipPackPurchaseSheet } from "@/components/coach/clip-pack-purchase-sheet"

/** Deep-link wrapper: opens clip pack sheet then returns. */
export default function BuyReplaysScreen() {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    setOpen(true)
  }, [])

  return (
    <View style={{ flex: 1 }}>
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
