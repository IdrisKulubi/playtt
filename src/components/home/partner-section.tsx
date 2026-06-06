import Link from "next/link";

export function PartnerSection() {
  return (
    <section
      id="partners"
      aria-labelledby="partner-heading"
      className="azure-block py-16 lg:py-24"
    >
      <div className="section-shell">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="space-y-6">
            <div className="marketing-accent-bar" />
            <h2
              id="partner-heading"
              className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl"
            >
              Need a partner?
            </h2>
            <p className="max-w-md text-base leading-relaxed text-primary-foreground/85">
              Match with players near you, your level, your schedule. PlayTT is
              more than a space — it&apos;s a community ready when you are.
            </p>
            <Link href="/sign-up" className="ghost-on-azure">
              Connect with players
            </Link>
          </div>

          <div
            aria-hidden
            className="relative min-h-56 overflow-hidden rounded-[var(--radius-card)] border-2 border-primary-foreground/20 bg-primary-foreground/10 lg:min-h-72"
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-medium uppercase tracking-[0.2em] text-primary-foreground/50">
                Community play
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
