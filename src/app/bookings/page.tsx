import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  ClockIcon,
  CreditCardIcon,
  MapPinIcon,
  PlusIcon,
} from "@phosphor-icons/react/dist/ssr";

import { PlayerShell } from "@/components/layout/player-shell";
import { Button } from "@/components/ui/button";

const reservationStates = [
  {
    title: "Payment",
    copy: "Unpaid sessions stay visible until checkout is complete.",
    icon: CreditCardIcon,
  },
  {
    title: "Upcoming",
    copy: "Confirmed reservations keep the time, table, and access status together.",
    icon: ClockIcon,
  },
  {
    title: "Completed",
    copy: "Past sessions collect here once the rally is over.",
    icon: CalendarCheckIcon,
  },
] as const;

export default function BookingsPage() {
  return (
    <PlayerShell eyebrow="Your reservations" title="Bookings">
      <section className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:gap-6">
        <div className="quiet-panel overflow-hidden bg-[var(--background-elevated)]">
          <div className="grid min-h-[25rem] gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(17rem,0.55fr)]">
            <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10">
              <div>
                <div className="flex size-12 items-center justify-center rounded-[var(--radius-field)] bg-primary/12 text-primary">
                  <CalendarCheckIcon className="size-6" weight="fill" />
                </div>
                <p className="section-label mt-8">No sessions yet</p>
                <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">
                  Book your first table, then track every detail here.
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Reservations, payment status, venue details, and post-session history will settle into this space after checkout.
                </p>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="min-w-52">
                  <Link href="/book">
                    <PlusIcon className="size-4" />
                    Book a session
                    <ArrowRightIcon className="size-4" />
                  </Link>
                </Button>
                <p className="max-w-xs text-xs leading-5 text-muted-foreground">
                  Takes under a minute once you know your time and group size.
                </p>
              </div>
            </div>

            <div className="border-t border-border bg-card p-5 sm:p-6 lg:border-l lg:border-t-0">
              <p className="section-label">Reservation flow</p>
              <div className="mt-6 space-y-3">
                {reservationStates.map(({ title, copy, icon: Icon }) => (
                  <div
                    key={title}
                    className="rounded-[var(--radius-field)] border border-border bg-background px-4 py-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="size-4" weight="fill" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-foreground">
                          {title}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                          {copy}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="grid gap-5 sm:grid-cols-2 2xl:block 2xl:space-y-5">
          <div className="quiet-panel p-5">
            <MapPinIcon className="size-6 text-primary" weight="fill" />
            <p className="mt-5 text-sm font-semibold text-foreground">
              PlayTT Hurlingham
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Private table tennis sessions with clear time, group, and payment records.
            </p>
            <Button asChild variant="outline" className="mt-5 w-full rounded-full">
              <Link href="/book">
                View availability
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="quiet-panel p-5">
            <p className="section-label">Next step</p>
            <p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-foreground">
              Pick a slot.
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Choose a time, set your group size, then confirm payment from checkout.
            </p>
          </div>
        </aside>
      </section>
    </PlayerShell>
  );
}
