"use client";

import Link from "next/link";
import { ArrowRightIcon, LockKeyIcon, PingPongIcon } from "@phosphor-icons/react";

import { SessionPanel } from "@/components/auth/session-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,183,255,0.16),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(0,183,255,0.08),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_42%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-12 px-6 py-8 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-3">
            <span className="inline-flex size-11 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
              TT
            </span>
            <div>
              <p className="text-sm font-semibold tracking-[0.24em] text-white">
                PLAYTT
              </p>
              <p className="text-xs text-white/45">
                Autonomous Table Tennis. Anytime.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild variant="ghost">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-up">Create account</Link>
            </Button>
          </div>
        </header>

        <section className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div className="space-y-8">
            <Badge className="border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] tracking-[0.2em] text-primary uppercase">
              Initial auth setup
            </Badge>

            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-white md:text-7xl">
                Build the booking platform on top of a clean auth foundation.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-white/68 md:text-lg">
                This screen is now our first checkpoint. If account creation, email
                verification, sign-in, session loading, and sign-out all work here,
                we can move into booking with confidence.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="min-w-48">
                <Link href="/sign-up">
                  Start with sign up
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="min-w-48">
                <Link href="/sign-in">Already have an account</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="min-w-48">
                <Link href="/book">View booking workspace</Link>
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.75rem] border border-white/8 bg-white/[0.04] p-5">
                <PingPongIcon className="size-5 text-primary" weight="fill" />
                <p className="mt-4 text-lg font-semibold text-white">Player-first</p>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  The booking journey starts with a frictionless account flow.
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-white/8 bg-white/[0.04] p-5">
                <LockKeyIcon className="size-5 text-primary" weight="fill" />
                <p className="mt-4 text-lg font-semibold text-white">Access-ready</p>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  Session identity will later map directly to door access and
                  booking ownership.
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-white/8 bg-white/[0.04] p-5">
                <p className="text-sm text-white/58">Next milestone</p>
                <p className="mt-4 text-lg font-semibold text-white">
                  Availability + booking quote
                </p>
              </div>
            </div>
          </div>

          <div>
            <SessionPanel />
          </div>
        </section>
      </div>
    </main>
  );
}
