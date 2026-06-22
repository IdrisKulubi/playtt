import Link from "next/link";
import { MapPinIcon } from "@phosphor-icons/react/dist/ssr";

import type { LocationSummary } from "@/server/bookings/types";
import { cn } from "@/lib/utils";

export function getVenueTag(location: LocationSummary): string {
  return location.resources.length > 1 ? "Multi table" : "Private";
}

interface VenueThumbProps {
  className?: string;
}

function VenueThumb({ className }: VenueThumbProps) {
  return (
    <div className={cn("venue-card__thumb", className)}>
      <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/20 to-transparent">
        <MapPinIcon className="size-8 text-primary/60" weight="duotone" />
      </div>
    </div>
  );
}

interface VenueCardProps {
  location: LocationSummary;
  className?: string;
}

export function VenueCard({ location, className }: VenueCardProps) {
  const tag = getVenueTag(location);

  return (
    <Link
      href={`/book?venue=${location.slug}`}
      className={cn("venue-card group", className)}
    >
      <VenueThumb />
      <div className="space-y-2">
        <span className="booking-tier-badge">{tag}</span>
        <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
          {location.name}
        </h3>
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <MapPinIcon className="mt-0.5 size-3.5 shrink-0 text-primary/80" />
          {location.address}
        </p>
      </div>
    </Link>
  );
}

interface VenueTicketCardProps {
  location: LocationSummary;
  className?: string;
}

export function VenueTicketCard({ location, className }: VenueTicketCardProps) {
  const tag = getVenueTag(location);

  return (
    <Link
      href={`/book?venue=${location.slug}`}
      className={cn("venue-ticket-card group", className)}
    >
      <div className="venue-ticket-card__thumb">
        <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/20 to-transparent">
          <MapPinIcon className="size-6 text-primary/60" weight="duotone" />
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <span className="booking-tier-badge">{tag}</span>
        <h3 className="truncate text-base font-semibold tracking-[-0.02em] text-foreground">
          {location.name}
        </h3>
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <MapPinIcon className="mt-0.5 size-3.5 shrink-0 text-primary/80" />
          <span className="line-clamp-2">{location.address}</span>
        </p>
      </div>
    </Link>
  );
}
