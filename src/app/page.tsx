import Link from "next/link";

import { HeroSection } from "@/components/home/hero-section";
import { HowItWorksSection } from "@/components/home/how-it-works-section";
import { LocationsSection } from "@/components/home/locations-section";
import { PartnerSection } from "@/components/home/partner-section";
import { SiteFooter } from "@/components/home/site-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { Button } from "@/components/ui/button";
import { getBookingBootstrapData } from "@/server/bookings/service";

const navLinks = [
  { label: "Locations", href: "#locations" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Partners", href: "#partners" },
] as const;

export default async function Page() {
  const { locations } = await getBookingBootstrapData();
  const featuredLocation = locations[0] ?? null;

  return (
    <MarketingShell
      navLinks={[...navLinks]}
      actions={
        <>
          <Link
            href="/sign-in"
            className="shell-nav-link hidden sm:inline"
          >
            Sign in
          </Link>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex"
          >
            <Link href="/sign-up">Create account</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/book">Book now</Link>
          </Button>
        </>
      }
      footer={<SiteFooter />}
    >
      <HeroSection featuredLocation={featuredLocation} />
      <HowItWorksSection />
      <LocationsSection locations={locations} />
      <PartnerSection />
    </MarketingShell>
  );
}
