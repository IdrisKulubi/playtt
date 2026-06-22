import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

import { VenueTicketCard } from "@/components/home/venue-card";
import type { LocationSummary } from "@/server/bookings/types";

interface HeroVenueTeaserProps {
  location: LocationSummary | null;
}

export function HeroVenueTeaser({ location }: HeroVenueTeaserProps) {
  if (!location) {
    return (
      <div className="premium-card space-y-3 p-5">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Venues are opening soon. Create an account to get notified when
          booking goes live.
        </p>
        <Link
          href="/book"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Check availability
          <ArrowRightIcon className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="section-label">Featured venue</p>
      <VenueTicketCard location={location} />
    </div>
  );
}
