import {
  CalendarBlankIcon,
  MapPinIcon,
  UsersIcon,
} from "@phosphor-icons/react/dist/ssr";

const steps = [
  {
    id: "1",
    title: "Choose a venue",
    body: "Pick the pod closest to you — see address and table setup before you book.",
    icon: MapPinIcon,
  },
  {
    id: "2",
    title: "Pick a time",
    body: "See open slots in real time and choose a 30- or 60-minute session.",
    icon: CalendarBlankIcon,
  },
  {
    id: "3",
    title: "Confirm & play",
    body: "Set your group size, review the total, then check in contactless when you arrive.",
    icon: UsersIcon,
  },
] as const;

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="border-t border-border py-16 lg:py-24"
    >
      <div className="section-shell space-y-12 lg:space-y-16">
        <header className="max-w-xl space-y-3">
          <div className="marketing-accent-bar" />
          <h2
            id="how-heading"
            className="text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl"
          >
            How it works
          </h2>
          <p className="text-muted-foreground">
            From venue to table in three calm steps.
          </p>
        </header>

        <ol className="grid gap-6 lg:grid-cols-3 lg:gap-6">
          {steps.map((step) => {
            const Icon = step.icon;

            return (
              <li key={step.id}>
                <article className="premium-card flex h-full flex-col gap-5 p-6">
                  <span className="text-sm font-semibold tabular-nums text-primary">
                    {step.id}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-[var(--background-elevated)] text-primary">
                      <Icon className="size-5" weight="bold" />
                    </span>
                    <h3 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </article>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
