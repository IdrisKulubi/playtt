import Link from "next/link";
import Image from "next/image";

import { HowItWorksMotion } from "@/components/home/how-it-works-motion";

const steps: Array<{
  id: string;
  title: string;
  body: string;
  image: string;
  kicker: string;
}> = [
  {
    id: "01",
    kicker: "Find your table",
    title: "Choose your pod",
    body: "Pick a private PlayTT pod close to you. The room is yours, not a shared court.",
    image: "/images/venue.jpeg",
  },
  {
    id: "02",
    kicker: "Make it yours",
    title: "Lock in a time",
    body: "See live slots, choose your session, then let the evening take shape around it.",
    image: "/images/time.jpeg",
  },
  {
    id: "03",
    kicker: "You are on",
    title: "Confirm and play",
    body: "Review once, reserve in seconds, and arrive to a table that is ready for your rally.",
    image: "/images/confirm.jpeg",
  },
];

export function HowItWorksSection() {
  return (
    <HowItWorksMotion>
      <section id="how-it-works" aria-labelledby="how-heading" className="how-rally-section">
        <div className="section-shell how-rally-shell">
          <header className="how-rally-heading" data-how-heading>
            <p className="section-label">One good plan, three easy moves</p>
            <h2 id="how-heading">From “we should play” to first serve.</h2>
            <p>Follow the rally. Your booking takes less time than choosing who serves first.</p>
          </header>

          <div className="how-rally-list">
            <div className="how-rally-rail" data-how-rail aria-hidden />
            <div className="how-rally-ball" data-how-ball aria-hidden />
            <ol>
              {steps.map((step, index) => (
              <li key={step.id} className={`how-rally-stage how-rally-stage--${index + 1}`} data-how-stage>
                <div className="how-rally-step-copy" data-how-copy>
                  <p className="how-rally-step-number">{step.id}</p>
                  <p className="how-rally-step-kicker">{step.kicker}</p>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  {index === 0 ? (
                    <Link href="#locations" className="how-rally-link">
                      See our pods <span aria-hidden>↗</span>
                    </Link>
                  ) : null}
                  {index === 1 ? (
                    <Link href="/book" className="how-rally-link">
                      See live times <span aria-hidden>↗</span>
                    </Link>
                  ) : null}
                  {index === 2 ? (
                    <Link href="/sign-up" className="how-rally-link">
                      Create your account <span aria-hidden>↗</span>
                    </Link>
                  ) : null}
                </div>

                <div className="how-rally-phone" data-how-phone aria-label={`${step.title} booking screen`}>
                  <div className="how-rally-phone__speaker" />
                  <div className="how-rally-phone__screen">
                    <Image
                      src={step.image}
                      alt={`${step.title} in the PlayTT mobile app`}
                      width={720}
                      height={1536}
                      sizes="(min-width: 1024px) 256px, 208px"
                      className="size-full object-cover"
                    />
                  </div>
                </div>
              </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </HowItWorksMotion>
  );
}
