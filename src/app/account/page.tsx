import { PlayerShell } from "@/components/layout/player-shell";
import { SessionPanel } from "@/components/auth/session-panel";

export default function AccountPage() {
  return (
    <PlayerShell eyebrow="Player settings" title="Account">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
        <div className="quiet-panel p-6 sm:p-8">
          <p className="section-label">Your PlayTT account</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Keep your details ready for the next session.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
            Profile, verification, and security actions will stay in this one quiet place.
          </p>
        </div>
        <SessionPanel />
      </section>
    </PlayerShell>
  );
}

