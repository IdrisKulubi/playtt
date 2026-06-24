import Link from "next/link";
import { ArrowRightIcon, CalendarCheckIcon } from "@phosphor-icons/react/dist/ssr";

import { SessionPanel } from "@/components/auth/session-panel";
import { PlayerShell } from "@/components/layout/player-shell";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <PlayerShell eyebrow="Your player space" title="Home" backHref="/">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <div className="quiet-panel bg-[var(--background-elevated)] p-6 sm:p-8">
          <p className="section-label">Ready when you are</p>
          <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Your next rally starts with a time.
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground">
            Pick a slot, choose your group, then keep everything in one place.
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="min-w-52">
              <Link href="/book">
                <CalendarCheckIcon className="mr-2 size-4" />
                Book a session
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
        <SessionPanel />
      </section>
    </PlayerShell>
  );
}
