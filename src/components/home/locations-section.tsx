import Link from "next/link";
import { ArrowUpRightIcon, MapPinIcon } from "@phosphor-icons/react/dist/ssr";

import { getVenueTag } from "@/components/home/venue-card";
import { LocationsMotion } from "@/components/home/locations-motion";
import type { LocationSummary } from "@/server/bookings/types";

const markerPositions = [
  { left: "20%", top: "63%" },
  { left: "50%", top: "36%" },
  { left: "77%", top: "58%" },
  { left: "67%", top: "22%" },
] as const;

interface LocationsSectionProps {
  locations: LocationSummary[];
}

export function LocationsSection({ locations }: LocationsSectionProps) {
  const featured = locations[0] ?? null;

  return (
    <LocationsMotion>
      <section id="locations" aria-labelledby="locations-heading" className="locations-atlas">
        <div className="section-shell locations-atlas__shell">
          <header className="locations-atlas__heading" data-locations-heading>
            <p className="section-label">Nairobi, on your terms</p>
            <h2 id="locations-heading">Meet you at <span>the table.</span></h2>
            <div className="locations-atlas__intro">
              <p>Private pods, real availability, and one very good plan for tonight.</p>
              <p><strong>{locations.length}</strong> live {locations.length === 1 ? "pod" : "pods"} in Nairobi</p>
            </div>
          </header>

          {locations.length === 0 ? (
            <div className="locations-atlas__empty">
              No pods are available to book right now. <Link href="/book">Check back soon.</Link>
            </div>
          ) : (
            <div className="locations-atlas__body">
              <div className="locations-atlas__map" data-locations-map aria-label="PlayTT pod locations in Nairobi">
                <svg className="locations-atlas__map-lines" viewBox="0 0 800 500" aria-hidden>
                  <path data-locations-path d="M88 365 C202 278 284 396 404 214 S610 148 716 295" />
                  <path d="M96 92 L706 406" />
                  <path d="M172 435 L606 65" />
                  <circle data-locations-orbit cx="420" cy="246" r="138" />
                  <circle data-locations-orbit cx="420" cy="246" r="88" />
                </svg>
                <p className="locations-atlas__map-label">PlayTT pod network</p>
                <p className="locations-atlas__map-status"><span data-locations-status-dot /> Live in Nairobi</p>
                {featured ? (
                  <div className="locations-atlas__featured" data-locations-featured>
                    <span className="locations-atlas__pulse locations-atlas__pulse--one" data-locations-pulse />
                    <span className="locations-atlas__pulse locations-atlas__pulse--two" data-locations-pulse />
                    <p>Now reserving</p>
                    <h3>{featured.name}</h3>
                    <span>{featured.address}</span>
                    <Link href={`/book?venue=${featured.slug}`} className="locations-atlas__featured-action">
                      Reserve a rally <ArrowUpRightIcon aria-hidden />
                    </Link>
                  </div>
                ) : null}
                {locations.map((location, index) => {
                  const position = index === 0 ? { left: "54%", top: "50%" } : markerPositions[index % markerPositions.length];
                  return (
                    <Link
                      key={location.id}
                      href={`/book?venue=${location.slug}`}
                      className="locations-atlas__marker"
                      data-location-marker
                      style={position}
                    >
                      <span className="locations-atlas__marker-dot"><MapPinIcon weight="fill" /></span>
                      <span className={index === 0 ? "sr-only" : undefined}>{location.name}</span>
                    </Link>
                  );
                })}
              </div>

              <ol className="locations-atlas__list">
                {locations.map((location, index) => (
                  <li key={location.id} data-location-row>
                    <Link href={`/book?venue=${location.slug}`} className="locations-atlas__row group">
                      <span className="locations-atlas__index">{String(index + 1).padStart(2, "0")}</span>
                      <span className="locations-atlas__row-copy">
                        <span className="locations-atlas__row-title">
                          {location.name} <em>{getVenueTag(location)}</em>
                        </span>
                        <span>{location.address}</span>
                      </span>
                      <span className="locations-atlas__row-action">
                        Book this pod <ArrowUpRightIcon aria-hidden />
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </section>
    </LocationsMotion>
  );
}
