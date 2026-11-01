import { useFocusEffect } from "expo-router"
import { useCallback, useState } from "react"

import { fetchSharedBookings } from "@/lib/community-api"
import type { CommunitySharedBooking } from "@/lib/community-types"

/** Bookings I'm playing with someone through Community (M4). */
export function useSharedBookings(enabled = true) {
  const [bookings, setBookings] = useState<CommunitySharedBooking[]>([])
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    if (!enabled) return
    try {
      setBookings(await fetchSharedBookings())
    } catch {
      // Extra context only; the screen still works without it.
    } finally {
      setLoaded(true)
    }
  }, [enabled])

  useFocusEffect(
    useCallback(() => {
      void reload()
    }, [reload]),
  )

  return { bookings, setBookings, loaded, reload }
}
