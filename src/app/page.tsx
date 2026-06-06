import Link from "next/link";

import { HeroSection } from "@/components/home/hero-section";
import { HowItWorksSection } from "@/components/home/how-it-works-section";
import { LocationsSection } from "@/components/home/locations-section";
import { PartnerSection } from "@/components/home/partner-section";
import { SiteFooter } from "@/components/home/site-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { Button } from "@/components/ui/button";

const navLinks = [
  { label: "Locations", href: "#locations" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Partners", href: "#partners" },
] as const;

export default function Page() {
  return (
    <MarketingShell
      navLinks={[...navLinks]}
      actions={
        <>
          <Link href="/sign-in" className="shell-nav-link hidden sm:inline">
            Sign in
          </Link>
          <Button asChild>
            <Link href="/book">Book</Link>
          </Button>
        </>
      }
      footer={<SiteFooter />}
    >
      <HeroSection />
      <HowItWorksSection />
      <LocationsSection />
      <PartnerSection />
    </MarketingShell>
  );
}
