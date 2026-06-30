import { HeroSection } from "@/components/home/hero-section";
import { HomeScrollMotion } from "@/components/home/home-scroll-motion";
import { HowItWorksSection } from "@/components/home/how-it-works-section";
import { LocationsSection } from "@/components/home/locations-section";
import { PartnerSection } from "@/components/home/partner-section";
import { SiteFooter } from "@/components/home/site-footer";
import { MarketingNavActions } from "@/components/layout/marketing-nav-actions";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { getBookingBootstrapData } from "@/server/bookings/service";

const navLinks = [
  { label: "Locations", href: "#locations" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Get started", href: "#get-started" },
] as const;

export default async function Page() {
  const { locations } = await getBookingBootstrapData();
  const featuredLocation = locations[0] ?? null;

  return (
    <MarketingShell
      navLinks={[...navLinks]}
      actions={<MarketingNavActions />}
      footer={<SiteFooter />}
    >
      <HomeScrollMotion>
        <HeroSection featuredLocation={featuredLocation} />
        <div data-home-scroll-section>
          <HowItWorksSection />
        </div>
        <div data-home-scroll-section>
          <LocationsSection locations={locations} />
        </div>
        <div data-home-scroll-section>
          <PartnerSection />
        </div>
      </HomeScrollMotion>
    </MarketingShell>
  );
}
