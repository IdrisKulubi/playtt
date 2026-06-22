import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

import { GetStartedMotion } from "@/components/home/get-started-motion";

export function PartnerSection() {
  return (
    <GetStartedMotion>
      <section id="get-started" aria-labelledby="get-started-heading" className="closing-cta">
        <div className="closing-cta__surface" data-cta-surface>
          <span className="closing-cta__ball closing-cta__ball--one" data-cta-ball aria-hidden />
          <span className="closing-cta__ball closing-cta__ball--two" data-cta-ball aria-hidden />
          <div className="section-shell closing-cta__shell">
            <p className="section-label" data-cta-content>Your table is calling</p>
            <h2 id="get-started-heading" data-cta-content>
              Bring the people.<br />
              <span>We’ll bring the rally.</span>
            </h2>
            <div className="closing-cta__bottom" data-cta-content>
              <p>Make a free PlayTT account to manage bookings, invite your crew, and be ready when the mood strikes.</p>
              <Link href="/sign-up" className="closing-cta__action group">
                Sign up free <ArrowRightIcon aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </GetStartedMotion>
  );
}
