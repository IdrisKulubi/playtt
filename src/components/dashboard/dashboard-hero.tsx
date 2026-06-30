import Link from "next/link"
import { ArrowRightIcon, CalendarCheckIcon } from "@phosphor-icons/react/dist/ssr"

import { BookingPaymentButton } from "@/components/bookings/booking-payment-button"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { UserBookingSummary } from "@/server/bookings/types"

type DashboardHeroProps = {
  paymentNeeded?: UserBookingSummary
  upcoming?: UserBookingSummary
  startingSoon?: boolean
}

function getHeroContent(
  paymentNeeded?: UserBookingSummary,
  upcoming?: UserBookingSummary,
) {
  if (paymentNeeded) {
    return {
      badge: "Payment needed",
      badgeVariant: "outline" as const,
      title: "Finish payment and keep your table.",
      copy: "One checkout step turns the hold into a confirmed PlayTT session.",
    }
  }

  if (upcoming) {
    return {
      badge: "Next session ready",
      badgeVariant: "default" as const,
      title: "Your table is waiting.",
      copy: "Manage players, payment, and access from your session below.",
    }
  }

  return null
}

export function DashboardHero({
  paymentNeeded,
  upcoming,
  startingSoon,
}: DashboardHeroProps) {
  const content = getHeroContent(paymentNeeded, upcoming)
  if (!content) return null

  const activeBooking = paymentNeeded ?? upcoming
  const compact = Boolean(activeBooking)

  return (
    <section className="quiet-panel bg-[var(--background-elevated)] p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={content.badgeVariant}>{content.badge}</Badge>
            {startingSoon ? (
              <Badge variant="outline">Starting soon</Badge>
            ) : null}
          </div>
          <h2
            className={`mt-4 font-semibold tracking-[-0.04em] text-foreground ${
              compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"
            }`}
          >
            {content.title}
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
            {content.copy}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {paymentNeeded ? (
            <>
              <BookingPaymentButton bookingId={paymentNeeded.id} />
              <Button asChild variant="ghost" size="sm">
                <Link href={`/bookings/${paymentNeeded.id}`}>View session</Link>
              </Button>
            </>
          ) : upcoming ? (
            <>
              <Button asChild size="lg">
                <Link href={`/bookings/${upcoming.id}`}>
                  View session
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/book">Book another</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild size="lg">
                <Link href="/book">
                  <CalendarCheckIcon className="size-4" weight="fill" />
                  Book a session
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/bookings">View bookings</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
