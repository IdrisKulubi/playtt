import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden pb-8 pt-2 lg:pb-16 lg:pt-6"
    >
      <div
        aria-hidden
        className="playtt-grid pointer-events-none absolute inset-0 -top-8 opacity-60"
      />
      <div
        aria-hidden
        className="hero-orb -right-24 top-0 size-72 bg-primary/25 lg:size-96"
      />

      <div className="section-shell relative">
        <header className="max-w-3xl space-y-6 lg:space-y-8">
          <p className="section-label">Nairobi · Private pods</p>
          <h1
            id="hero-heading"
            className="text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl lg:text-[3.75rem] lg:leading-[1.02]"
          >
            Private table tennis,
            <br />
            booked in a tap.
          </h1>
          <p className="max-w-[36ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
            Reserve a private pod, pick your time, and play — no front desk, no
            guesswork.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="min-w-52 rounded-full">
              <Link href="/book">
                Book a session
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
            <Link
              href="#locations"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              See venues
            </Link>
          </div>
        </header>
      </div>
    </section>
  );
}
