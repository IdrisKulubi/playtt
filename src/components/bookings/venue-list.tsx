import { ArrowRightIcon, MapPinIcon } from "@phosphor-icons/react";

import type { LocationSummary } from "@/server/bookings/types";

interface VenueListProps {
  locations: LocationSummary[];
  selectedLocationId: string;
  onSelect: (locationId: string) => void;
}

export function VenueList({ locations, selectedLocationId, onSelect }: VenueListProps) {
  return (
    <section className="booking-stage booking-venue-stage">
      <div className="booking-stage__intro">
        <div>
          <p className="booking-stage__eyebrow">Step 1 of 3</p>
          <h2>Where do you want to play?</h2>
          <p>Pick a PlayTT venue to see available sessions.</p>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {locations.map((location) => {
          const active = location.id === selectedLocationId;
          const tableCount = location.resources.length;

          return (
            <li key={location.id}>
              <button
                type="button"
                onClick={() => onSelect(location.id)}
                className={`flex w-full items-center gap-3 px-4 py-4 text-left transition sm:gap-4 sm:px-5 ${
                  active ? "bg-primary/[0.06]" : "hover:bg-[var(--surface-soft)]"
                }`}
              >
                <div className="venue-thumb" aria-hidden>
                  <MapPinIcon className="size-6" weight="fill" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{location.name}</p>
                  <div className="mt-0.5 flex items-start gap-1.5 text-sm text-muted-foreground">
                    <MapPinIcon className="mt-0.5 size-3.5 shrink-0" weight="fill" />
                    <span className="leading-snug">{location.address}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {tableCount > 1 ? "Multi table" : "1 table"}
                    </span>
                  </div>
                </div>
                <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground/50" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
