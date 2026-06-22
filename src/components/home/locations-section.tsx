import Link from "next/link";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr";

import { VenueCard } from "@/components/home/venue-card";
import type { LocationSummary } from "@/server/bookings/types";

interface LocationsSectionProps {
  locations: LocationSummary[];
}

export function LocationsSection({ locations }: LocationsSectionProps) {
  return (
    <section
      id="locations"
      aria-labelledby="locations-heading"
      className="border-t border-border py-16 lg:py-24"
    >
      <div className="section-shell space-y-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <div className="marketing-accent-bar" />
            <h2
              id="locations-heading"
              className="text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl"
            >
              Find a pod near you
            </h2>
          </div>
          <Link
            href="/book"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            View all locations
            <CaretRightIcon className="size-4" />
          </Link>
        </header>

        {locations.length === 0 ? (
          <div className="quiet-panel p-8 text-sm leading-relaxed text-muted-foreground">
            No venues are available to book right now.{" "}
            <Link
              href="/book"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Check back soon
            </Link>
            .
          </div>
        ) : (
          <ul className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
            {locations.map((location) => (
              <li key={location.id}>
                <VenueCard location={location} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
