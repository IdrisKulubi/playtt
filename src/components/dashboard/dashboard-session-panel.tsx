"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowRightIcon,
  ClockIcon,
  CreditCardIcon,
  MapPinIcon,
  PencilSimpleIcon,
  ShareNetworkIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react"

import { BookingPaymentButton } from "@/components/bookings/booking-payment-button"
import {
  buildDirectionsUrl,
  buildSessionShareText,
  canShowAccessPolicy,
  formatBookingTimeRange,
  formatEditWindowLabel,
  formatMoney,
  formatPaymentCountdown,
  formatPaymentStatus,
  formatStartsInLabel,
  needsBookingPayment,
} from "@/components/bookings/booking-utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { UserBookingSummary } from "@/server/bookings/types"

function PaymentCountdown({ expiresAt }: { expiresAt: string | null }) {
  const [label, setLabel] = useState(() => formatPaymentCountdown(expiresAt))

  useEffect(() => {
    if (!expiresAt) return

    const intervalId = setInterval(() => {
      setLabel(formatPaymentCountdown(expiresAt))
    }, 1000)

    return () => clearInterval(intervalId)
  }, [expiresAt])

  if (!label) return null

  return (
    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
      {label}
    </span>
  )
}

function StartsInLabel({ startTime }: { startTime: string }) {
  const [label, setLabel] = useState(() => formatStartsInLabel(startTime))

  useEffect(() => {
    const intervalId = setInterval(() => {
      setLabel(formatStartsInLabel(startTime))
    }, 30_000)

    return () => clearInterval(intervalId)
  }, [startTime])

  if (!label) return null

  return (
    <Badge variant="outline" className="border-primary/40 text-primary">
      {label}
    </Badge>
  )
}

function InviteCrewButton({ booking }: { booking: UserBookingSummary }) {
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
    <Button variant="outline" size="sm" onClick={() => void handleShare()}>
      <ShareNetworkIcon className="size-4" />
      Invite crew
    </Button>
  )
}

type DashboardSessionPanelProps = {
  booking: UserBookingSummary
  startingSoon?: boolean
}

export function DashboardSessionPanel({
  booking,
  startingSoon,
}: DashboardSessionPanelProps) {
  const showPayment = needsBookingPayment(booking)
  const showAccess = canShowAccessPolicy(booking)
  const directionsUrl = booking.locationAddress
    ? buildDirectionsUrl(booking.locationAddress)
    : null

  const statusItems = [
    {
      label: "Payment",
      value: showPayment ? "Unpaid — finish checkout" : formatPaymentStatus(booking.paymentStatus),
    },
    {
      label: "Players",
      value: `${booking.groupSize} confirmed`,
    },
    {
      label: "Edit window",
      value: formatEditWindowLabel(booking),
    },
    ...(showAccess
      ? [{ label: "Access", value: "Available 15 minutes before play" }]
      : []),
  ]

  return (
    <section className="quiet-panel overflow-hidden bg-[var(--background-elevated)]">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="section-label">Next session</p>
          {startingSoon ? <StartsInLabel startTime={booking.startTime} /> : null}
        </div>

        <h3 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-foreground">
          {booking.locationName}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{booking.resourceName}</p>

        <div className="mt-5 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
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

        {showPayment ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <PaymentCountdown expiresAt={booking.expiresAt} />
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {statusItems.map((item) => (
            <div
              key={item.label}
              className="rounded-[var(--radius-field)] border border-border bg-card px-4 py-3"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={`/bookings/${booking.id}`}>
              View session
              <ArrowRightIcon className="size-4" />
            </Link>
          </Button>

          {showPayment ? <BookingPaymentButton bookingId={booking.id} /> : null}

          {booking.editable ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/bookings/${booking.id}?edit=players`}>
                <PencilSimpleIcon className="size-4" />
                Edit players
              </Link>
            </Button>
          ) : null}

          {!showPayment ? <InviteCrewButton booking={booking} /> : null}

          {directionsUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
                <MapPinIcon className="size-4" />
                Get directions
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
