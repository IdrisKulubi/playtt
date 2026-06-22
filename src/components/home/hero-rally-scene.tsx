import Link from "next/link";
import { ArrowUpRightIcon, MapPinIcon } from "@phosphor-icons/react/dist/ssr";

interface HeroRallySceneProps {
  locationName: string | null;
  locationSlug: string | null;
}

export function HeroRallyScene({
  locationName,
  locationSlug,
}: HeroRallySceneProps) {
  const venueName = locationName ?? "PlayTT Hurlingham";
  const bookingHref = locationSlug ? `/book?venue=${locationSlug}` : "/book";

  return (
    <div className="hero-rally-scene">
      <svg
        className="hero-rally-scene__svg"
        viewBox="0 0 900 640"
        fill="none"
        role="presentation"
      >
        <defs>
          <radialGradient id="rally-light" cx="58%" cy="46%" r="54%">
            <stop offset="0%" stopColor="#00b7ff" stopOpacity="0.2" />
            <stop offset="58%" stopColor="#00b7ff" stopOpacity="0.045" />
            <stop offset="100%" stopColor="#00b7ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse
          data-rally-light
          cx="520"
          cy="328"
          rx="405"
          ry="300"
          fill="url(#rally-light)"
        />

        <g data-rally-room>
          <path d="M112 78 H818" />
          <path d="M112 78 L242 246" />
          <path d="M818 78 L676 246" />
          <path d="M74 526 H850" />
          <path d="M74 526 L242 246" />
          <path d="M850 526 L676 246" />
          <path d="M723 138 V418" />
          <path d="M756 138 V418" />
        </g>

        <g data-rally-court>
          <path d="M160 488 L374 300 H750 L874 488 Z" />
          <path d="M374 300 L336 548" />
          <path d="M750 300 L798 548" />
          <path d="M160 488 H874" />
          <path d="M336 548 H798" />
          <path d="M561 300 V548" />
        </g>

        <g data-rally-net>
          <path d="M360 380 H770" />
          <path d="M360 380 L360 350" />
          <path d="M770 380 L770 350" />
          <path d="M375 370 H755" opacity="0.45" />
        </g>

        <path
          data-rally-trajectory
          d="M96 566 C202 526 252 334 420 260 C546 205 628 142 746 172"
        />
        <circle data-rally-ball cx="96" cy="566" r="10" />
        <circle data-rally-ball-core cx="96" cy="566" r="3" />
      </svg>

      <Link
        className="hero-rally-booking"
        data-rally-booking
        data-hero-action
        href={bookingHref}
        aria-label={`Book ${venueName}`}
      >
        <span className="hero-rally-booking__eyebrow">Next rally</span>
        <span className="hero-rally-booking__venue">
          <MapPinIcon aria-hidden className="size-4 text-primary" weight="fill" />
          {venueName}
        </span>
        <span className="hero-rally-booking__time">
          Today <b>18:30</b> <span>60 min</span>
          <ArrowUpRightIcon aria-hidden className="ml-auto size-4" />
        </span>
      </Link>

      <span className="hero-rally-chip hero-rally-chip--one" data-rally-chip>
        Private pod
      </span>
      <span className="hero-rally-chip hero-rally-chip--two" data-rally-chip>
        Bring your crew
      </span>
      <span className="hero-rally-chip hero-rally-chip--three" data-rally-chip>
        No waiting
      </span>

      <p className="hero-rally-caption" data-rally-caption>
        Court 01 <span aria-hidden>·</span> Ready when you are
      </p>
    </div>
  );
}
