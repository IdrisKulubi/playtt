import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

import { HeroVenueTeaser } from "@/components/home/hero-venue-teaser";
import { Button } from "@/components/ui/button";
import type { LocationSummary } from "@/server/bookings/types";

const trustSignals = [
  "Private pods",
  "Clear pricing",
  "Mobile booking",
] as const;

interface HeroSectionProps {
  featuredLocation: LocationSummary | null;
}

export function HeroSection({ featuredLocation }: HeroSectionProps) {
  return (
    <section
      aria-labelledby="hero-heading"
      className="marketing-hero-band"
    >
      <div
        aria-hidden
        className="playtt-grid pointer-events-none absolute inset-0 opacity-40"
      />

      <div className="section-shell relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12">
        <header className="max-w-xl space-y-6 lg:space-y-7">
          <p className="section-label">Nairobi · Private pods</p>
          <div className="space-y-4">
            <h1
              id="hero-heading"
              className="text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl lg:text-[3.5rem] lg:leading-[1.04]"
            >
              Private table tennis,
              <br />
              on your schedule.
            </h1>
            <p className="max-w-[38ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
              Reserve a private pod, pick your time, and play — no front desk, no
              guesswork.
            </p>
            <p className="text-sm font-medium text-foreground/80">
              Autonomous Table Tennis. Anytime.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            <Button asChild size="lg" className="min-w-44 rounded-full">
              <Link href="/book">
                Book now
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-w-44 rounded-full"
            >
              <Link href="/sign-up">Create account</Link>
            </Button>
            <Link
              href="#locations"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline sm:ml-1"
            >
              See venues
            </Link>
          </div>

          <ul className="marketing-trust-strip">
            {trustSignals.map((signal, index) => (
              <li key={signal} className="marketing-trust-strip__item">
                {index > 0 ? (
                  <span aria-hidden className="marketing-trust-strip__separator">
                    ·
                  </span>
                ) : null}
                <span>{signal}</span>
              </li>
            ))}
          </ul>
        </header>

        <HeroVenueTeaser location={featuredLocation} />
      </div>
    </section>
  );
}
