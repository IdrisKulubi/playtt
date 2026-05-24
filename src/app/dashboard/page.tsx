import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  HouseLineIcon,
  SparkleIcon,
} from "@phosphor-icons/react/dist/ssr";

import { SessionPanel } from "@/components/auth/session-panel";
import { ProductShell } from "@/components/layout/product-shell";
import { Button } from "@/components/ui/button";

const checkpoints = [
  {
    title: "Identity connected",
    copy: "Your account session can now own bookings and carry future access permissions.",
  },
  {
    title: "Booking flow polished",
    copy: "The product moves from location to slot to group size to review in a clear sequence.",
  },
  {
    title: "Checkout-ready totals",
    copy: "Pricing, surcharges, and booking summary states are in place before payment wiring.",
  },
] as const;

export default function DashboardPage() {
  return (
    <ProductShell
      eyebrow="Player dashboard"
      title="Account and booking command center"
      description="This screen should feel like a clean staging point before a reservation: the account state is visible, the booking path is obvious, and nothing competes for attention."
      actions={
        <>
          <Button asChild variant="ghost">
            <Link href="/">
              <HouseLineIcon className="mr-2 size-4" />
              Home
            </Link>
          </Button>
          <Button asChild>
            <Link href="/book">
              Book now
              <ArrowRightIcon className="size-4" />
            </Link>
          </Button>
        </>
      }
    >
      <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="glass-panel p-6 sm:p-8">
          <p className="section-label">Today's experience</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">
            Everything important is one action away.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/62">
            The dashboard is here to orient the player, not distract them. It confirms identity,
            reinforces what PlayTT does well, and gives a clear path into booking.
          </p>

          <div className="mt-8 grid gap-4">
            {checkpoints.map((checkpoint) => (
              <article key={checkpoint.title} className="premium-card p-5">
                <div className="flex items-start gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                    <SparkleIcon className="size-5" weight="fill" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-white">{checkpoint.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-white/56">{checkpoint.copy}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="min-w-52">
              <Link href="/book">
                <CalendarCheckIcon className="mr-2 size-4" />
                Open booking flow
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="min-w-52">
              <Link href="/">Return home</Link>
            </Button>
          </div>
        </div>

        <SessionPanel />
      </section>
    </ProductShell>
  );
}
