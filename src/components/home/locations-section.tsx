import Link from "next/link";
import { CaretRightIcon, MapPinIcon } from "@phosphor-icons/react/dist/ssr";

const venues = [
  {
    id: "westlands",
    name: "Westlands",
    address: "Ring Road, Westlands",
    tag: "Multi table",
  },
  {
    id: "kilimani",
    name: "Kilimani",
    address: "Argwings Kodhek Rd",
    tag: "Private",
  },
  {
    id: "karen",
    name: "Karen",
    address: "Karen Road",
    tag: "Multi table",
  },
  {
    id: "lavington",
    name: "Lavington",
    address: "James Gichuru Rd",
    tag: "Private",
  },
  {
    id: "parklands",
    name: "Parklands",
    address: "Limuru Road",
    tag: "Multi table",
  },
  {
    id: "cbd",
    name: "CBD",
    address: "Moi Avenue",
    tag: "Private",
  },
] as const;

export function LocationsSection() {
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

        <ul className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
          {venues.map((venue) => (
            <li key={venue.id}>
              <Link
                href={`/book?venue=${venue.id}`}
                className="location-card group"
              >
                <div className="location-card__thumb">
                  <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/20 to-transparent">
                    <MapPinIcon
                      className="size-8 text-primary/60"
                      weight="duotone"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="booking-tier-badge">{venue.tag}</span>
                  <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                    {venue.name}
                  </h3>
                  <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <MapPinIcon className="size-3.5 shrink-0 text-primary/80" />
                    {venue.address}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
