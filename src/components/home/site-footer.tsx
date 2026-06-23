import Link from "next/link";
import {
  InstagramLogoIcon,
  TiktokLogoIcon,
  XLogoIcon,
} from "@phosphor-icons/react/dist/ssr";

import { SiteFooterMotion } from "@/components/home/site-footer-motion";
import { BrandMark } from "@/components/layout/brand-mark";

type FooterSection = "Product" | "Company" | "Legal" | "Connect";

const footerLinks: Record<FooterSection, readonly { label: string; href: string }[]> =
  {
    Connect: [
      { label: "Twitter", href: "#" },
      { label: "Instagram", href: "#" },
      { label: "TikTok", href: "#" },
    ],
    Company: [
      { label: "About", href: "#" },
      { label: "Careers", href: "#" },
    ],
    Legal: [
      { label: "Terms", href: "#" },
      { label: "Privacy", href: "#" },
    ],
    Product: [
      { label: "Book", href: "/book" },
      { label: "Locations", href: "#locations" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Create account", href: "/sign-up" },
    ],
  };

// Correct mapping between label and icon component
const socialIcons = {
  Twitter: XLogoIcon,
  Instagram: InstagramLogoIcon,
  TikTok: TiktokLogoIcon,
};

export function SiteFooter() {
  return (
    <SiteFooterMotion>
      <div className="site-footer">
        <div className="section-shell site-footer__shell">
          <p className="site-footer__word" data-footer-word aria-hidden>
            PLAYTT
          </p>

          <div className="site-footer__grid">
            <div className="space-y-4 lg:col-span-1" data-footer-group>
              <BrandMark />
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                Premium, self-serve table tennis. Reserve a pod, play on your
                terms.
              </p>
            </div>

            {Object.entries(footerLinks).map(([title, links]) => (
              <nav
                key={title}
                aria-label={title}
                className="space-y-3"
                data-footer-group
              >
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground">
                  {title}
                </h3>

                {title === "Connect" ? (
                  <ul className="site-footer__socials" aria-label="Social links">
                    {links.map((link) => {
                      // Only render the Icon if it's defined in the map
                      const Icon = socialIcons[link.label as keyof typeof socialIcons];
                      return (
                        <li key={link.label}>
                          <Link
                            href={link.href}
                            className="site-footer__social-link"
                            aria-label={link.label}
                            title={link.label}
                          >
                            {Icon ? (
                              <Icon aria-hidden="true" weight="fill" />
                            ) : null}
                            <span className="sr-only">{link.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <ul className="space-y-2">
                    {links.map((link) => (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          className="text-sm text-muted-foreground transition hover:text-foreground"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </nav>
            ))}
          </div>

          <div className="site-footer__base" data-footer-base>
            <p>&copy; 2026 PlayTT. All rights reserved.</p>
          </div>
        </div>
      </div>
    </SiteFooterMotion>
  );
}
