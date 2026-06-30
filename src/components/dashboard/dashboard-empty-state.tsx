import Link from "next/link"
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  ClockIcon,
  CreditCardIcon,
  MapPinIcon,
} from "@phosphor-icons/react/dist/ssr"

import { Button } from "@/components/ui/button"

export function DashboardEmptyState() {
  return (
    <section className="quiet-panel overflow-hidden bg-[var(--background-elevated)]">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.5fr)]">
        <div className="flex flex-col justify-between p-6 sm:p-8">
          <div>
            <div className="flex size-12 items-center justify-center rounded-[var(--radius-field)] bg-primary/12 text-primary">
              <CalendarCheckIcon className="size-6" weight="fill" />
            </div>
            <p className="section-label mt-8">Ready when you are</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">
              Make tonight the easy plan.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              Pick a slot, bring your group, and step into a private rally
              without the usual back-and-forth.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg">
              <Link href="/book">
                <CalendarCheckIcon className="size-4" weight="fill" />
                Book a session
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/bookings">View bookings</Link>
            </Button>
          </div>
        </div>

        <div className="border-t border-border bg-card p-5 sm:p-6 lg:border-l lg:border-t-0">
          <p className="section-label">How booking works</p>
          <div className="mt-5 space-y-3">
            {[
              { icon: MapPinIcon, title: "Pick venue", copy: "Choose your PlayTT location." },
              { icon: ClockIcon, title: "Choose time", copy: "Select a slot that fits your crew." },
              { icon: CreditCardIcon, title: "Pay securely", copy: "Confirm with M-Pesa via Paystack." },
            ].map(({ icon: Icon, title, copy }) => (
              <div
                key={title}
                className="rounded-[var(--radius-field)] border border-border bg-background px-4 py-3"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Icon className="size-4 text-primary" weight="fill" />
                  {title}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {copy}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
