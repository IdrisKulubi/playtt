import { CalendarBlankIcon, MapPinIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr";

const steps = [
  {
    id: "1",
    title: "Find a venue",
    body: "Pick the pod closest to you — Westlands, Kilimani, and more.",
    icon: MapPinIcon,
  },
  {
    id: "2",
    title: "Pick a time",
    body: "See open slots in real time and choose a 30- or 60-minute session.",
    icon: CalendarBlankIcon,
    featured: true,
  },
  {
    id: "3",
    title: "Play",
    body: "Check in contactless, grab a paddle, and hit the table.",
    icon: PlayIcon,
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
            From discovery to the table in three steps.
          </p>
        </header>

        <ol className="grid gap-8 lg:grid-cols-3 lg:gap-6">
          {steps.map((step) => {
            const Icon = step.icon;
            const featured = "featured" in step && step.featured;

            return (
              <li key={step.id}>
                <article
                  className={
                    featured
                      ? "flex h-full flex-col gap-6 rounded-[var(--radius-card)] border border-border bg-card p-6"
                      : "flex h-full flex-col space-y-4 rounded-[var(--radius-card)] border border-border bg-card p-6"
                  }
                >
                  <div className="space-y-4">
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
                  </div>

                  {featured ? (
                    <div
                      aria-hidden
                      className="relative mt-auto min-h-40 overflow-hidden rounded-[var(--radius-field)] border border-border bg-[var(--background-elevated)]"
                    >
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/15 via-transparent to-transparent">
                        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                          Pod interior
                        </span>
                      </div>
                    </div>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
