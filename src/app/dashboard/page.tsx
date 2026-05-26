import Link from "next/link";
import { ArrowRightIcon, CalendarCheckIcon } from "@phosphor-icons/react/dist/ssr";

import { SessionPanel } from "@/components/auth/session-panel";
import { ProductShell } from "@/components/layout/product-shell";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <ProductShell
      eyebrow="Dashboard"
      title="Your account"
      description="Book a session or return home."
      backHref="/"
      backLabel="Back to home"
    >
      <section className="grid gap-6 px-4 sm:px-5 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="quiet-panel p-6 sm:p-8">
          <p className="text-sm leading-7 text-muted-foreground">
            Pick a venue, choose a time, set your group size, and review before you pay.
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
    </ProductShell>
  );
}
