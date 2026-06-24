import { UsersThreeIcon } from "@phosphor-icons/react/dist/ssr";

import { PlayerShell } from "@/components/layout/player-shell";

export default function CommunityPage() {
  return (
    <PlayerShell eyebrow="Play together" title="Community">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
        <div className="quiet-panel p-6 sm:p-8">
          <UsersThreeIcon className="size-7 text-primary" weight="fill" />
          <p className="section-label mt-6">Coming together</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Find the people behind the rally.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
            Community updates, player events, and shared highlights will live here as the PlayTT network grows.
          </p>
        </div>
        <aside className="quiet-panel p-6">
          <p className="text-sm font-semibold text-foreground">Start with your crew</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Book a private session and invite the people you want on the table.
          </p>
        </aside>
      </section>
    </PlayerShell>
  );
}

