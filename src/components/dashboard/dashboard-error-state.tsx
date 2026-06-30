import Link from "next/link"
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr"

import { Button } from "@/components/ui/button"

export function DashboardErrorState() {
  return (
    <section className="quiet-panel bg-[var(--background-elevated)] p-6 sm:p-8">
      <div className="flex max-w-2xl flex-col items-start gap-5">
        <span className="flex size-12 items-center justify-center rounded-[var(--radius-field)] bg-destructive/10 text-destructive">
          <WarningCircleIcon className="size-6" weight="fill" />
        </span>
        <div>
          <p className="section-label">Could not load sessions</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-foreground">
            Your bookings did not sync.
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Refresh this page or open your bookings list. If the problem
            continues, check your connection and try again.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/bookings">View bookings</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Refresh home</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
