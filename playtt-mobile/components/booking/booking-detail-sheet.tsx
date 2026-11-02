import { useEffect, useState } from "react"

import { BookingDetailContent } from "@/components/booking/booking-detail-content"
import { EmptyState } from "@/components/kit/empty-state"
import { Sheet } from "@/components/kit/sheet"
import { BookingDetailSkeleton } from "@/components/ui/skeleton"
import { useSkeletonSurface } from "@/hooks/use-product-theme"
import { fetchBookingById } from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
import { toast } from "@/lib/toast"

type BookingDetailSheetProps = {
  visible: boolean
  bookingId: string | null
  onClose: () => void
  onBookingChanged?: () => void
}

/** A booking as a sheet: half height to glance, full height to manage. */
export function BookingDetailSheet({
  visible,
  bookingId,
  onClose,
  onBookingChanged,
}: BookingDetailSheetProps) {
  // Keep showing the last booking while the sheet animates closed.
  const [shownId, setShownId] = useState(bookingId)
  if (bookingId && bookingId !== shownId) setShownId(bookingId)

  return (
    <Sheet
      visible={visible}
      title="Your booking"
      detents={["medium", "large"]}
      scrollable
      onClose={onClose}
    >
      {shownId ? (
        <BookingDetailLoader
          key={shownId}
          bookingId={shownId}
          onClose={onClose}
          onBookingChanged={onBookingChanged}
        />
      ) : null}
    </Sheet>
  )
}

type LoaderProps = {
  bookingId: string
  onClose: () => void
  onBookingChanged?: () => void
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; booking: UserBookingSummary }

function BookingDetailLoader({ bookingId, onClose, onBookingChanged }: LoaderProps) {
  const skeletonSurface = useSkeletonSurface()
  const [state, setState] = useState<LoadState>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const booking = await fetchBookingById(bookingId)
        if (!mounted) return
        setState(booking ? { status: "ready", booking } : { status: "error" })
      } catch (error) {
        if (!mounted) return
        setState({ status: "error" })
        toast.apiError(error, "Could not load this booking.")
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [attempt, bookingId])

  if (state.status === "loading") return <BookingDetailSkeleton surface={skeletonSurface} />

  if (state.status === "error") {
    return (
      <EmptyState
        icon="exclamationmark.triangle.fill"
        title="Couldn't load this booking"
        message="Check your connection, then try again."
        action={{
          label: "Try again",
          onPress: () => {
            setState({ status: "loading" })
            setAttempt((value) => value + 1)
          },
        }}
      />
    )
  }

  return (
    <BookingDetailContent
      booking={state.booking}
      onBookingUpdated={(updated) => {
        setState({ status: "ready", booking: updated })
        onBookingChanged?.()
      }}
      onBookingCancelled={() => {
        onClose()
        onBookingChanged?.()
      }}
    />
  )
}
