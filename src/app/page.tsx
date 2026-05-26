import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

import { BookingJourneyTimeline } from "@/components/home/booking-journey-timeline";
import { HomeAccountSection } from "@/components/home/home-account-section";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { Button } from "@/components/ui/button";

const journeySteps = [
  { id: "01", title: "Pick a venue" },
  { id: "02", title: "See availability" },
  { id: "03", title: "Set the group" },
  { id: "04", title: "Review and pay" },
] as const;

const trustSignals = ["Private pods", "Clear pricing", "Mobile booking"] as const;

export default function Page() {
  return (
    <MarketingShell
      navLinks={[{ label: "Dashboard", href: "/dashboard" }]}
      actions={
        <>
          <Link href="/sign-in" className="shell-nav-link hidden sm:inline">
            Sign in
          </Link>
          <Button asChild>
            <Link href="/book">Book</Link>
          </Button>
        </>
      }
    >
      <section
        id="journey"
        aria-labelledby="journey-heading"
        className="mx-auto flex w-full max-w-4xl flex-col gap-10 pt-6 lg:gap-12 lg:pt-10"
      >
        <header className="space-y-4 text-center lg:space-y-5">
          <p className="section-label">Autonomous Table Tennis. Anytime.</p>
          <h1
            id="journey-heading"
            className="text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl lg:text-[3.25rem] lg:leading-[1.05]"
          >
            Four steps to a private session
          </h1>
          <p className="mx-auto max-w-xl text-base leading-7 text-muted-foreground">
            Venue, timing, group size, then checkout.
          </p>
        </header>

        <BookingJourneyTimeline steps={journeySteps} />

        <ul
          aria-label="Trust signals"
          className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-sm text-muted-foreground"
        >
          {trustSignals.map((signal, index) => (
            <li key={signal} className="flex items-center gap-2">
              {index > 0 ? (
                <span aria-hidden className="text-white/24">
                  ·
                </span>
              ) : null}
              <span>{signal}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col items-center gap-4">
          <Button asChild size="lg" className="min-w-52">
            <Link href="/book">
              Book a session
              <ArrowRightIcon className="size-4" />
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            New here?{" "}
            <Link href="/sign-up" className="text-primary underline-offset-4 hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </section>

      <HomeAccountSection />
    </MarketingShell>
  );
}
