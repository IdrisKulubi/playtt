import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

export function PartnerSection() {
  return (
    <section
      id="partners"
      aria-labelledby="partner-heading"
      className="azure-block py-16 lg:py-24"
    >
      <div className="section-shell">
        <div className="mx-auto max-w-2xl space-y-6 text-center lg:max-w-3xl">
          <div className="marketing-accent-bar mx-auto" />
          <h2
            id="partner-heading"
            className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl"
          >
            Ready when you are
          </h2>
          <p className="mx-auto max-w-lg text-base leading-relaxed text-primary-foreground/85">
            Create an account to book sessions, manage your schedule, and pick up
            where you left off — on web or mobile.
          </p>
          <Link href="/sign-up" className="ghost-on-azure inline-flex items-center">
            Create account
            <ArrowRightIcon className="ml-2 size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
