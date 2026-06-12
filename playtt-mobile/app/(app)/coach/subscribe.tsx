import { router } from "expo-router"
import { useEffect, useState } from "react"
import { View } from "react-native"

import { CoachSubscribeSheet } from "@/components/coach/coach-subscribe-sheet"

/** Deep-link wrapper: opens Coach subscribe sheet then returns. */
export default function CoachSubscribeScreen() {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    setOpen(true)
  }, [])

  return (
    <View style={{ flex: 1 }}>
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
