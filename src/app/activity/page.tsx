import Link from "next/link";
import { ArrowRightIcon, ChartBarIcon } from "@phosphor-icons/react/dist/ssr";

import { PlayerShell } from "@/components/layout/player-shell";
import { Button } from "@/components/ui/button";

export default function ActivityPage() {
  return (
    <PlayerShell eyebrow="Your time on the table" title="Activity">
      <section className="quiet-panel p-6 sm:p-8">
        <ChartBarIcon className="size-7 text-primary" weight="fill" />
        <p className="section-label mt-6">Session history</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
          Your highlights start after your first session.
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
          This space will collect your sessions, replays, and the moments worth watching again.
        </p>
        <Button asChild variant="outline" className="mt-7 rounded-full">
          <Link href="/book">
            Book your first session
            <ArrowRightIcon className="ml-2 size-4" />
          </Link>
        </Button>
      </section>
    </PlayerShell>
  );
}

