import { MapPinIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";

export const HERO_PHONE_SCREENS = ["venues", "timing", "checkout"] as const;
export type HeroPhoneScreen = (typeof HERO_PHONE_SCREENS)[number];

interface PreviewVenuesScreenProps {
  locationName: string | null;
}

export function PreviewVenuesScreen({ locationName }: PreviewVenuesScreenProps) {
  const venues = locationName
    ? [locationName, "Kilimani", "Westlands"]
    : ["Hurlingham", "Kilimani", "Westlands"];

  return (
    <div className="hero-preview-screen">
      <p className="hero-preview-screen__title">Book</p>
      <ul className="hero-preview-venues">
        {venues.map((name, index) => (
          <li
            key={name}
            className={cn(
              "hero-preview-venues__row",
              index === 0 && "hero-preview-venues__row--active"
            )}
          >
            <span className="hero-preview-venues__thumb">
              <MapPinIcon className="size-3.5" weight="fill" />
            </span>
            <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
              {name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PreviewTimingScreen() {
  const slots = ["6:00 PM", "6:30 PM", "7:00 PM"];

  return (
    <div className="hero-preview-screen">
      <p className="hero-preview-screen__title">Pick a time</p>
      <p className="hero-preview-screen__subtitle">Today · 60 min</p>
      <ul className="hero-preview-slots">
        {slots.map((time, index) => (
          <li
            key={time}
            className={cn(
              "hero-preview-slots__row",
              index === 1 && "hero-preview-slots__row--active"
            )}
          >
            <span className="text-[11px] font-medium">{time}</span>
            <span className="text-[10px] text-muted-foreground">KES 2,400</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface PreviewCheckoutScreenProps {
  locationName: string | null;
}

export function PreviewCheckoutScreen({
  locationName,
}: PreviewCheckoutScreenProps) {
  const venueLabel = locationName ?? "Hurlingham";

  return (
    <div className="hero-preview-screen hero-preview-screen--checkout">
      <p className="hero-preview-screen__title">Review</p>
      <div className="hero-preview-checkout">
        <div className="space-y-1 text-[10px] text-muted-foreground">
          <p>{venueLabel} · 60 min</p>
          <p>Today · 6:30 PM · 2 players</p>
        </div>
        <div className="hero-preview-checkout__bar">
          <div>
            <p className="text-[9px] opacity-70">Total</p>
            <p className="text-[11px] font-semibold tabular-nums">KES 2,400</p>
          </div>
          <span className="hero-preview-checkout__cta">Reserve</span>
        </div>
      </div>
    </div>
  );
}

interface HeroPhoneScreenContentProps {
  screen: HeroPhoneScreen;
  locationName: string | null;
}

export function HeroPhoneScreenContent({
  screen,
  locationName,
}: HeroPhoneScreenContentProps) {
  switch (screen) {
    case "venues":
      return <PreviewVenuesScreen locationName={locationName} />;
    case "timing":
      return <PreviewTimingScreen />;
    case "checkout":
      return <PreviewCheckoutScreen locationName={locationName} />;
  }
}
