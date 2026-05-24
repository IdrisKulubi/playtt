import Link from "next/link";
import { CalendarCheckIcon, HouseLineIcon } from "@phosphor-icons/react/dist/ssr";

import { getBookingBootstrapData } from "@/server/bookings/service";
import { BookingConsole } from "@/components/bookings/booking-console";
import { ProductShell } from "@/components/layout/product-shell";
import { Button } from "@/components/ui/button";

export default async function BookPage() {
  const { locations } = await getBookingBootstrapData();

  return (
    <ProductShell
      eyebrow="PlayTT booking"
      title="Reserve a private session with clear, confident steps"
      description="The booking experience is organized around real player decisions: choose the location, see live timing availability, set the group, and review a quiet checkout summary."
      backHref="/dashboard"
      backLabel="Back to dashboard"
      actions={
        <Button asChild variant="ghost">
          <Link href="/">
            <HouseLineIcon className="mr-2 size-4" />
            Home
          </Link>
        </Button>
      }
    >
      <section className="grid gap-4 lg:grid-cols-3">
        <article className="premium-card p-5">
          <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <CalendarCheckIcon className="size-5" weight="fill" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">Location-first</h2>
          <p className="mt-2 text-sm leading-7 text-white/56">
            Players begin by choosing where they want to play, which keeps the journey intuitive from the first tap.
          </p>
        </article>
        <article className="premium-card p-5">
          <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <CalendarCheckIcon className="size-5" weight="fill" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">Availability clarity</h2>
          <p className="mt-2 text-sm leading-7 text-white/56">
            Open-table counts stay visible in the slot stage so availability feels concrete, not abstract.
          </p>
        </article>
        <article className="premium-card p-5">
          <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <CalendarCheckIcon className="size-5" weight="fill" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">Transparent pricing</h2>
          <p className="mt-2 text-sm leading-7 text-white/56">
            Group size sits before checkout, with larger-group adjustments shown before the player commits.
          </p>
        </article>
      </section>

      {locations.length === 0 ? (
        <div className="glass-panel p-8 text-sm text-white/60">
          No active locations or resources were found. Run the Phase 1 seed or add a location and resource first.
        </div>
      ) : (
        <BookingConsole locations={locations} />
      )}
    </ProductShell>
  );
}
