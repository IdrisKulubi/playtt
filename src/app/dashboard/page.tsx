import { headers } from "next/headers"

import { DashboardAccountStrip } from "@/components/dashboard/dashboard-account-strip"
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state"
import { DashboardErrorState } from "@/components/dashboard/dashboard-error-state"
import { DashboardHero } from "@/components/dashboard/dashboard-hero"
import { DashboardLastSessionCard } from "@/components/dashboard/dashboard-last-session-card"
import { DashboardQuickLinks } from "@/components/dashboard/dashboard-quick-links"
import { DashboardSessionPanel } from "@/components/dashboard/dashboard-session-panel"
import {
  isPastBooking,
  isSessionStartingSoon,
  needsBookingPayment,
} from "@/components/bookings/booking-utils"
import { PlayerShell } from "@/components/layout/player-shell"
import { auth } from "../../../auth"
import { listBookingsForUserEnriched } from "@/server/bookings/service"
import type { UserBookingSummary } from "@/server/bookings/types"

export const dynamic = "force-dynamic"

function getDashboardBookings(bookings: UserBookingSummary[]) {
  const now = Date.now()
  const paymentNeeded = bookings.find((booking) => needsBookingPayment(booking))
  const upcoming = bookings.find(
    (booking) =>
      new Date(booking.endTime).getTime() >= now && !needsBookingPayment(booking),
  )
  const lastCompleted = bookings
    .filter((booking) => isPastBooking(booking, now))
    .sort(
      (left, right) =>
        new Date(right.endTime).getTime() - new Date(left.endTime).getTime(),
    )[0]

  const activeBooking = paymentNeeded ?? upcoming
  const startingSoon = activeBooking
    ? isSessionStartingSoon(activeBooking.startTime)
    : false

  return { paymentNeeded, upcoming, lastCompleted, activeBooking, startingSoon }
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  let bookings: UserBookingSummary[] = []
  let loadError = false

  if (session?.user) {
    try {
      bookings = await listBookingsForUserEnriched({ userId: session.user.id })
    } catch {
      loadError = true
    }
  }

  const { paymentNeeded, upcoming, lastCompleted, activeBooking, startingSoon } =
    getDashboardBookings(bookings)

  const hasActiveSession = Boolean(activeBooking)
  const showEmptyState = !loadError && session?.user && !hasActiveSession && !lastCompleted

  return (
    <PlayerShell eyebrow="Your player space" title="Home" backHref="/">
      <div className="space-y-5">
        {loadError ? (
          <DashboardErrorState />
        ) : (
          <>
            {hasActiveSession ? (
              <>
                <DashboardSessionPanel
                  booking={activeBooking!}
                  startingSoon={startingSoon}
                />
                <DashboardHero
                  paymentNeeded={paymentNeeded}
                  upcoming={upcoming}
                  startingSoon={startingSoon}
                />
              </>
            ) : showEmptyState ? (
              <DashboardEmptyState />
            ) : lastCompleted ? (
              <DashboardLastSessionCard booking={lastCompleted} />
            ) : null}

            <DashboardQuickLinks />
          </>
        )}

        <DashboardAccountStrip
          name={session?.user?.name}
          email={session?.user?.email}
        />
      </div>
    </PlayerShell>
  )
}
