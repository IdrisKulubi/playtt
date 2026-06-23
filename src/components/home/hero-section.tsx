import Link from "next/link";
import Image from "next/image";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

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
  const venueName = featuredLocation?.name ?? "PlayTT Hurlingham";

  return (
    <HeroSectionMotion>
      <div className="hero-words-shell">
        <div className="hero-words-layout">
          <header className="hero-words-copy">
            <div className="hero-words-meta">
              <p className="section-label" data-hero-eyebrow>
                Nairobi · Private pods
              </p>
              <p className="hero-words-availability" data-hero-availability>
                <span>Tonight at</span>
                <strong>{venueName}</strong>
              </p>
            </div>

            <div className="hero-words-main">
              <h1 id="hero-heading" className="hero-words-heading">
                <span className="hero-line">
                  <span className="hero-line__inner">Make time</span>
                </span>
                <span className="hero-line">
                  <span className="hero-line__inner">
                    for your <span className="hero-word hero-word--cream">rally.</span>
                  </span>
                </span>
              </h1>
              <p data-hero-subcopy className="hero-words-subcopy">
                Your own table, your own people, your own time. Book a private
                pod and play when the mood strikes.
              </p>
            </div>

            <div className="hero-words-actions">
              <div data-hero-cta-primary>
                <Button asChild size="lg" className="hero-words-primary min-w-48">
                  <Link href="/book" data-hero-action>
                    Book your rally
                    <ArrowRightIcon className="size-4" />
                  </Link>
                </Button>
              </div>
              <div data-hero-cta-secondary>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="hero-words-secondary min-w-44"
                >
                  <Link href="/sign-up" data-hero-action>
                    Create account
                  </Link>
                </Button>
              </div>
            </div>

            <ul className="hero-words-trust" data-hero-trust>
              {trustSignals.map((signal, index) => (
                <li key={signal}>
                  {index > 0 ? <span aria-hidden>·</span> : null}
                  {signal}
                </li>
              ))}
            </ul>
          </header>

          <div className="hero-phone-visual" data-hero-phone-visual>
            <div className="hero-phone-device" data-hero-phone-device>
              <span className="hero-phone-device__edge" aria-hidden />
              <span
                className="hero-phone-device__button hero-phone-device__button--top"
                aria-hidden
              />
              <span
                className="hero-phone-device__button hero-phone-device__button--bottom"
                aria-hidden
              />
              <div className="hero-phone-device__camera" aria-hidden>
                <span />
              </div>
              <div className="hero-phone-device__screen">
                <Image
                  src="/hero.jpeg"
                  alt="PlayTT mobile booking screen showing times at PlayTT Hurlingham"
                  width={774}
                  height={1548}
                  priority
                  sizes="(min-width: 1024px) 31vw, 72vw"
                  className="size-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="hero-words-ticker" aria-hidden>
          <div className="hero-words-ticker__track" data-hero-ticker>
            <div className="hero-words-ticker__group">
              <span>PRIVATE PODS · PLAY ON YOUR TERMS · </span>
              <span>PRIVATE PODS · PLAY ON YOUR TERMS · </span>
              <span>PRIVATE PODS · PLAY ON YOUR TERMS · </span>
              <span>PRIVATE PODS · PLAY ON YOUR TERMS · </span>
            </div>
            <div className="hero-words-ticker__group">
              <span>PRIVATE PODS · PLAY ON YOUR TERMS · </span>
              <span>PRIVATE PODS · PLAY ON YOUR TERMS · </span>
              <span>PRIVATE PODS · PLAY ON YOUR TERMS · </span>
              <span>PRIVATE PODS · PLAY ON YOUR TERMS · </span>
            </div>
          </div>
        </div>
      </div>
    </HeroSectionMotion>
  );
}
