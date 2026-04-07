"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  ClockCountdownIcon,
  MapPinIcon,
  PingPongIcon,
  ShieldCheckIcon,
  SparkleIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";

import { SessionPanel } from "@/components/auth/session-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const highlights = [
  {
    title: "Instant pod booking",
    description: "Select a location, see live table availability, and lock in a slot in a few deliberate steps.",
    icon: PingPongIcon,
  },
  {
    title: "Smart group pricing",
    description: "Built-in pricing adapts to session length, demand windows, and larger groups without confusing the player.",
    icon: UsersThreeIcon,
  },
  {
    title: "Account to access",
    description: "Authentication, booking ownership, and door access are designed as one connected product experience.",
    icon: ShieldCheckIcon,
  },
] as const;

const metrics = [
  { label: "Locations-ready UX", value: "01" },
  { label: "Steps to reserve", value: "04" },
  { label: "Designed for mobile first", value: "100%" },
] as const;

const steps = [
  {
    id: "01",
    title: "Pick a venue",
    copy: "Start with the place, not a form. Players first decide where they want to play, then the product narrows the decision space.",
  },
  {
    id: "02",
    title: "See live timing availability",
    copy: "Open-table counts stay visible in the timing stage so people understand what is still bookable before they commit.",
  },
  {
    id: "03",
    title: "Set the group",
    copy: "Group size is selected after timing, with transparent surcharges for larger bookings instead of hidden price jumps.",
  },
  {
    id: "04",
    title: "Review and reserve",
    copy: "A calm checkout summary reinforces confidence before payment and access flows take over.",
  },
] as const;

export default function Page() {
  return (
    <main className="relative min-h-screen overflow-hidden text-foreground">
      <div className="hero-orb left-[-8rem] top-10 h-72 w-72 bg-primary/20" />
      <div className="hero-orb right-[-7rem] top-28 h-80 w-80 bg-sky-500/12" />
      <div className="playtt-grid absolute inset-0 opacity-30" />

      <div className="app-shell min-h-screen gap-10">
        <header className="glass-panel sticky top-4 z-20 flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-full border border-primary/30 bg-primary/12 text-sm font-semibold text-primary">
              TT
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.26em] text-white">PLAYTT</p>
              <p className="text-xs text-white/50">Autonomous table tennis booking</p>
            </div>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Link className="text-sm text-white/60 transition hover:text-white" href="#experience">
              Experience
            </Link>
            <Link className="text-sm text-white/60 transition hover:text-white" href="#flow">
              Flow
            </Link>
            <Link className="text-sm text-white/60 transition hover:text-white" href="/dashboard">
              Account
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild variant="ghost">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild className="shadow-[0_14px_36px_rgba(0,183,255,0.28)]">
              <Link href="/book">Book now</Link>
            </Button>
          </div>
        </header>

        <section className="grid gap-8 pt-4 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div className="space-y-8">
            <div className="space-y-5">
              <Badge className="border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-primary">
                Premium booking experience
              </Badge>

              <div className="space-y-4">
                <p className="section-label">Designed for speed, clarity, and confidence</p>
                <h1 className="max-w-5xl text-5xl font-semibold tracking-[-0.04em] text-white md:text-7xl">
                  Reserve a PlayTT pod with the calm precision of a premium product.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-white/68 md:text-lg">
                  The homepage, booking journey, and session state now follow one intentional flow:
                  discover the brand, choose a venue, pick an open slot, set the group, and review a clear checkout summary.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="min-w-52 shadow-[0_16px_44px_rgba(0,183,255,0.28)]">
                <Link href="/book">
                  Start booking
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="min-w-52">
                <Link href="/sign-up">Create account</Link>
              </Button>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="stat-chip">
                <MapPinIcon className="size-4 text-primary" />
                Location-first flow
              </div>
              <div className="stat-chip">
                <ClockCountdownIcon className="size-4 text-primary" />
                Live timing decisions
              </div>
              <div className="stat-chip">
                <SparkleIcon className="size-4 text-primary" />
                Transparent group pricing
              </div>
            </div>
          </div>

          <div className="glass-panel-strong relative overflow-hidden p-6">
            <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,_rgba(0,183,255,0.22),_transparent_60%)]" />
            <div className="relative space-y-5">
              <div className="flex items-center justify-between">
                <p className="section-label">Flow preview</p>
                <Badge className="border border-white/10 bg-white/[0.05] text-white/70">
                  Production direction
                </Badge>
              </div>

              <div className="premium-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/50">Selected journey</p>
                    <p className="mt-2 text-2xl font-semibold text-white">Location to checkout</p>
                  </div>
                  <div className="rounded-full border border-primary/25 bg-primary/12 px-4 py-2 text-sm text-primary">
                    4 stages
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  {steps.map((step) => (
                    <div
                      key={step.id}
                      className="flex items-start gap-4 rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-4"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/12 text-sm font-semibold text-primary">
                        {step.id}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{step.title}</p>
                        <p className="mt-1 text-sm leading-6 text-white/55">{step.copy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {metrics.map((metric) => (
                  <div key={metric.label} className="rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-4">
                    <p className="text-2xl font-semibold text-white">{metric.value}</p>
                    <p className="mt-2 text-sm text-white/50">{metric.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="experience" className="grid gap-4 md:grid-cols-3">
          {highlights.map(({ title, description, icon: Icon }) => (
            <article key={title} className="premium-card p-6">
              <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <Icon className="size-6" weight="fill" />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-white">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-white/58">{description}</p>
            </article>
          ))}
        </section>

        <section id="flow" className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="glass-panel p-6 sm:p-8">
            <p className="section-label">Why this flow feels better</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">
              The product now reveals decisions in the order players actually make them.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/62">
              We removed the old workspace feeling and replaced it with a guided booking path.
              Each step reduces complexity: venue first, then real availability, then group configuration,
              then a checkout summary that makes the price legible.
            </p>

            <div className="mt-8 space-y-4">
              {steps.map((step) => (
                <div key={step.id} className="flex gap-4 border-t border-white/10 pt-4 first:border-t-0 first:pt-0">
                  <p className="text-sm font-semibold text-primary">{step.id}</p>
                  <div>
                    <p className="text-base font-medium text-white">{step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-white/55">{step.copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <SessionPanel />
        </section>
      </div>
    </main>
  );
}
