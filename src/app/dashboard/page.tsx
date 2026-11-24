import { headers } from "next/headers"

import { DashboardErrorState } from "@/components/dashboard/dashboard-error-state"
import {
  DashboardMoreLinks,
  DashboardPrimaryActions,
  DashboardRecentReplays,
  DashboardSignedOut,
  type DashboardCredits,
  type DashboardReplay,
} from "@/components/dashboard/dashboard-home"
import { DashboardSessionPanel } from "@/components/dashboard/dashboard-session-panel"
import {
  isSessionStartingSoon,
  needsBookingPayment,
} from "@/components/bookings/booking-utils"
import { PlayerShell } from "@/components/layout/player-shell"
import { auth } from "../../../auth"
import { listBookingsForUserEnriched } from "@/server/bookings/service"
import { getReplayCreditsStatus, listUserReplays } from "@/server/replays/service"
import { resolveTenantContextForUserId } from "@/server/tenancy/session-context"
import type { UserBookingSummary } from "@/server/bookings/types"

export const dynamic = "force-dynamic"

/** The booking that matters most right now: one waiting for payment, else the next one. */
function getActiveBooking(bookings: UserBookingSummary[]) {
  const now = Date.now()
  const paymentNeeded = bookings.find((booking) => needsBookingPayment(booking))
  const upcoming = bookings
    .filter((booking) => new Date(booking.endTime).getTime() >= now && !needsBookingPayment(booking))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0]
  return paymentNeeded ?? upcoming ?? null
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  const user = session?.user

  let bookings: UserBookingSummary[] = []
  let replays: DashboardReplay[] = []
  let credits: DashboardCredits | null = null
  let loadError = false

  if (user) {
    try {
      const context = await resolveTenantContextForUserId(user.id)
      // Replays and credits are secondary: if they fail, the page still works for booking.
      const [bookingResult, replayResult, creditResult] = await Promise.allSettled([
        listBookingsForUserEnriched({ context, userId: user.id }),
        listUserReplays(context, user.id),
        getReplayCreditsStatus(context, user.id),
      ])
      if (bookingResult.status === "fulfilled") bookings = bookingResult.value
      else loadError = true
      if (replayResult.status === "fulfilled") replays = replayResult.value
      if (creditResult.status === "fulfilled") credits = creditResult.value
    } catch {
      loadError = true
    }
  }

  const activeBooking = getActiveBooking(bookings)
  const firstName = user?.name?.trim().split(/\s+/)[0]
  const readyReplayCount = replays.filter((replay) => replay.status === "ready").length

  return (
    <PlayerShell eyebrow="PlayTT" title={firstName ? `Hi ${firstName}` : "Home"}>
      <div className="space-y-8">
        {!user ? (
          <DashboardSignedOut />
        ) : (
          <>
            {loadError ? <DashboardErrorState /> : null}

            {activeBooking ? (
              <DashboardSessionPanel
                booking={activeBooking}
                startingSoon={isSessionStartingSoon(activeBooking.startTime)}
              />
            ) : null}

            <DashboardPrimaryActions credits={credits} readyReplayCount={readyReplayCount} />

            <DashboardRecentReplays replays={replays} />

            <DashboardMoreLinks name={user.name} email={user.email} />
          </>
        )}
      </div>
    </PlayerShell>
  )
}
