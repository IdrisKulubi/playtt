import Link from "next/link";
import { CalendarCheckIcon, PlusIcon } from "@phosphor-icons/react/dist/ssr";

import { PlayerShell } from "@/components/layout/player-shell";
import { Button } from "@/components/ui/button";

export default function BookingsPage() {
  return (
    <PlayerShell eyebrow="Your reservations" title="Bookings">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="quiet-panel p-6 sm:p-8">
          <p className="section-label">No upcoming sessions</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Make time for your next rally.
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground">
            Your upcoming and past PlayTT sessions will stay here, including access and payment status.
          </p>
          <Button asChild className="mt-7 rounded-full">
            <Link href="/book">
              <PlusIcon className="mr-2 size-4" />
              Book a session
            </Link>
          </Button>
        </div>
        <aside className="quiet-panel p-5">
          <CalendarCheckIcon className="size-6 text-primary" weight="fill" />
          <p className="mt-4 text-sm font-semibold text-foreground">A calm record of play</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Payment-needed, upcoming, and completed sessions will be grouped here.
          </p>
        </aside>
      </section>
    </PlayerShell>
  );
}

