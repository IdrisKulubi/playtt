"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  ClockIcon,
  CreditCardIcon,
  MapPinIcon,
  PencilSimpleIcon,
  ShareNetworkIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react"

import { BookingPaymentButton } from "@/components/bookings/booking-payment-button"
import { BookingCancelHoldButton } from "@/components/bookings/booking-cancel-hold-button"
import { BookingEditReviewSheet } from "@/components/bookings/booking-edit-review-sheet"
import {
  type GroupSize,
  buildDirectionsUrl,
  buildSessionShareText,
  canShowAccessPolicy,
  formatBookingStatus,
  formatBookingTimeRange,
  formatEditWindowLabel,
  formatMoney,
  needsBookingPayment,
} from "@/components/bookings/booking-utils"
import { GroupSizeSheet } from "@/components/bookings/group-size-sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { UserBookingSummary } from "@/server/bookings/types"

type ModificationPreview = {
  currentTotal: string
  newTotal: string
  deltaAmount: string
  requiresPayment: boolean
  creditAmount: string
  newGroupSize: number
  newStartTime: string
  newEndTime: string
  currency: string
}

type ModificationApplyResult = {
  modificationId: string
  status: string
  requiresPayment: boolean
  authorizationUrl?: string
  displayText?: string
  creditAmount?: string
}

type BookingDetailViewProps = {
  booking: UserBookingSummary
  openEditOnMount?: boolean
}

export function BookingDetailView({
  booking: initialBooking,
  openEditOnMount = false,
}: BookingDetailViewProps) {
  const booking = initialBooking
  const router = useRouter()
  const [groupSheetOpen, setGroupSheetOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [groupSize, setGroupSize] = useState<GroupSize>(
    initialBooking.groupSize as GroupSize,
  )
  const [preview, setPreview] = useState<ModificationPreview | null>(null)
  const [isQuoting, setIsQuoting] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  const showPayment = needsBookingPayment(booking)
  const showAccess = canShowAccessPolicy(booking)
  const directionsUrl = booking.locationAddress
    ? buildDirectionsUrl(booking.locationAddress)
    : null

  useEffect(() => {
    if (openEditOnMount && booking.editable) {
      setGroupSheetOpen(true)
    }
  }, [openEditOnMount, booking.editable])

  const fetchQuote = useCallback(
    async (nextGroupSize: GroupSize) => {
      setIsQuoting(true)
      setPreview(null)

      try {
        const response = await fetch(
          `/api/bookings/${booking.id}/modifications/quote`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ groupSize: nextGroupSize }),
          },
        )
        const payload = (await response.json()) as {
          data?: { modificationPreview: ModificationPreview }
          message?: string
        }

        if (!response.ok || !payload.data?.modificationPreview) {
          throw new Error(payload.message ?? "Could not quote changes.")
        }

        setPreview(payload.data.modificationPreview)
        return payload.data.modificationPreview
      } finally {
        setIsQuoting(false)
      }
    },
    [booking.id],
  )

  async function handleGroupSizeContinue() {
    if (groupSize === booking.groupSize) {
      toast.info("Choose a different group size to update.")
      return
    }

    setGroupSheetOpen(false)
    setReviewOpen(true)
    try {
      await fetchQuote(groupSize)
    } catch (error) {
      setReviewOpen(false)
      toast.error(
        error instanceof Error ? error.message : "Could not quote changes.",
      )
    }
  }

  async function handleConfirmChanges() {
    setIsApplying(true)

    try {
      const response = await fetch(
        `/api/bookings/${booking.id}/modifications/apply`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ groupSize }),
        },
      )
      const payload = (await response.json()) as {
        data?: ModificationApplyResult
        message?: string
      }

      if (!response.ok || !payload.data) {
        throw new Error(payload.message ?? "Could not apply changes.")
      }

      const result = payload.data

      if (result.requiresPayment && result.authorizationUrl) {
        toast.success(result.displayText ?? "Opening secure checkout.")
        window.location.href = result.authorizationUrl
        return
      }

      toast.success(
        Number(result.creditAmount) > 0
          ? "Booking updated. The lower total is held as account credit."
          : "Booking updated.",
      )
      setReviewOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not apply changes.",
      )
    } finally {
      setIsApplying(false)
    }
  }

  async function handleShare() {
    const text = buildSessionShareText(booking)

    try {
      if (navigator.share) {
        await navigator.share({ title: "PlayTT session", text })
        return
      }

      await navigator.clipboard.writeText(text)
      toast.success("Session details copied.")
    } catch {
      toast.error("Could not share session details.")
    }
  }

  return (
    <>
      <div className="space-y-5">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/dashboard">
            <ArrowLeftIcon className="size-4" />
            Back to home
          </Link>
        </Button>

        <section className="quiet-panel bg-[var(--background-elevated)] p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={showPayment ? "outline" : "default"}>
              {formatBookingStatus(booking.status, booking.paymentStatus)}
            </Badge>
            {booking.editable ? (
              <Badge variant="outline">Editable</Badge>
            ) : null}
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-foreground">
            {booking.locationName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {booking.resourceName}
          </p>

          <div className="mt-6 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <span className="flex items-center gap-2">
              <ClockIcon className="size-4 text-primary" weight="fill" />
              {formatBookingTimeRange(booking)}
            </span>
            <span className="flex items-center gap-2">
              <UsersThreeIcon className="size-4 text-primary" weight="fill" />
              {booking.groupSize} players
            </span>
            <span className="flex items-center gap-2">
              <CreditCardIcon className="size-4 text-primary" weight="fill" />
              {formatMoney(booking.totalAmount, booking.currency)}
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[var(--radius-field)] border border-border bg-card px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Edit window
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {formatEditWindowLabel(booking)}
              </p>
            </div>
            {showAccess ? (
              <div className="rounded-[var(--radius-field)] border border-border bg-card px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Access
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  Available 15 minutes before play
                </p>
              </div>
            ) : null}
          </div>

          {booking.notes ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Notes: {booking.notes}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            {showPayment ? <BookingPaymentButton bookingId={booking.id} /> : null}
            {showPayment ? <BookingCancelHoldButton booking={booking} /> : null}

            {booking.editable ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGroupSheetOpen(true)}
              >
                <PencilSimpleIcon className="size-4" />
                Edit players
              </Button>
            ) : null}

            {!showPayment ? (
              <Button variant="outline" size="sm" onClick={() => void handleShare()}>
                <ShareNetworkIcon className="size-4" />
                Invite crew
              </Button>
            ) : null}

            {directionsUrl ? (
              <Button asChild variant="outline" size="sm">
                <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
                  <MapPinIcon className="size-4" />
                  Get directions
                </a>
              </Button>
            ) : null}
          </div>
        </section>
      </div>

      <GroupSizeSheet
        open={groupSheetOpen}
        groupSize={groupSize}
        currency={booking.currency}
        onOpenChange={setGroupSheetOpen}
        onGroupSizeChange={setGroupSize}
        onContinue={() => void handleGroupSizeContinue()}
      />

      <BookingEditReviewSheet
        open={reviewOpen}
        booking={booking}
        preview={preview}
        isQuoting={isQuoting}
        isApplying={isApplying}
        onClose={() => setReviewOpen(false)}
        onConfirm={() => void handleConfirmChanges()}
      />
    </>
  )
}
