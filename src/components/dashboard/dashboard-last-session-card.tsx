import Link from "next/link"
import { ArrowRightIcon, PlayCircleIcon } from "@phosphor-icons/react/dist/ssr"

import { formatBookingTimeRange } from "@/components/bookings/booking-utils"
import { Button } from "@/components/ui/button"
import type { UserBookingSummary } from "@/server/bookings/types"

export function DashboardLastSessionCard({
  booking,
}: {
  booking: UserBookingSummary
}) {
  return (
    <section className="quiet-panel p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PlayCircleIcon className="size-5" weight="fill" />
          </span>
          <div>
            <p className="section-label">Last session</p>
            <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-foreground">
              {booking.locationName}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatBookingTimeRange(booking)} · {booking.groupSize} players
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/activity">
            View activity
            <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
      </div>
    </section>
  )
}
