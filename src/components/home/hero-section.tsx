import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

import { HeroRallyScene } from "@/components/home/hero-rally-scene";
import { HeroSectionMotion } from "@/components/home/hero-section-motion";
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
    <HeroSectionMotion>
      <div className="section-shell hero-rally-shell relative flex min-h-[calc(100svh-5rem)] flex-col justify-center py-8 lg:py-10">
        <div className="hero-rally-layout">
          <header className="hero-rally-copy max-w-2xl space-y-6 lg:space-y-7">
            <p className="section-label" data-hero-eyebrow>
              Nairobi · Private pods
            </p>
            <div className="space-y-4">
              <h1
                id="hero-heading"
                className="text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl lg:text-[3.75rem] lg:leading-[1.04]"
              >
                <span className="hero-line">
                  <span className="hero-line__inner">Make time for</span>
                </span>
                <span className="hero-line">
                  <span className="hero-line__inner">
                    <span className="hero-word hero-word--coral">your rally.</span>
                  </span>
                </span>
              </h1>
              <p
                data-hero-subcopy
                className="max-w-[38ch] text-base leading-relaxed text-muted-foreground sm:text-lg"
              >
                Come as you are. Pick a private pod, bring your people, and let
                the next hour belong to you.
              </p>
              <p
                data-hero-tagline
                className="text-sm font-medium text-foreground/80"
              >
                Open late. Easy to book. Better with friends.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div data-hero-cta-primary>
                <Button
                  asChild
                  size="lg"
                  className="min-w-44 rounded-full bg-[#fff5da] text-[#17140f] hover:bg-[#cbff61]"
                >
                  <Link href="/book" data-hero-action>
                    Book now
                    <ArrowRightIcon className="size-4" />
                  </Link>
                </Button>
              </div>
              <div data-hero-cta-secondary>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="min-w-44 rounded-full border-[#fff5da]/35 text-[#fff5da] hover:border-[#cbff61] hover:bg-[#cbff61] hover:text-[#17140f]"
                >
                  <Link href="/sign-up" data-hero-action>
                    Create account
                  </Link>
                </Button>
              </div>
            </div>

            <ul className="marketing-trust-strip" data-hero-trust>
              {trustSignals.map((signal, index) => (
                <li key={signal} className="marketing-trust-strip__item">
                  {index > 0 ? (
                    <span
                      aria-hidden
                      className="marketing-trust-strip__separator"
                    >
                      ·
                    </span>
                  ) : null}
                  <span>{signal}</span>
                </li>
              ))}
            </ul>
          </header>

          <div className="hero-rally-visual" data-hero-rally-visual>
            <HeroRallyScene
              locationName={featuredLocation?.name ?? null}
              locationSlug={featuredLocation?.slug ?? null}
            />
          </div>
        </div>
      </div>
    </HeroSectionMotion>
  );
}
