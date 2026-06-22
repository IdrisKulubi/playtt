import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";
import { SiteFooterMotion } from "@/components/home/site-footer-motion";

const footerLinks = {
  Product: [
    { label: "Book", href: "/book" },
    { label: "Locations", href: "#locations" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Create account", href: "/sign-up" },
  ],
  Company: [
    { label: "About", href: "#" },
    { label: "Careers", href: "#" },
  ],
  Legal: [
    { label: "Terms", href: "#" },
    { label: "Privacy", href: "#" },
  ],
  Connect: [
    { label: "Twitter", href: "#" },
    { label: "Instagram", href: "#" },
    { label: "TikTok", href: "#" },
  ],
} as const;

export function SiteFooter() {
  return (
    <SiteFooterMotion>
      <div className="site-footer">
        <div className="section-shell site-footer__shell">
          <p className="site-footer__word" data-footer-word aria-hidden>PLAYTT</p>
          <div className="site-footer__grid">
          <div className="space-y-4 lg:col-span-1" data-footer-group>
            <BrandMark caption="Autonomous Table Tennis. Anytime." />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Premium, self-serve table tennis — reserve a pod, play on your
              terms.
            </p>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <nav key={title} aria-label={title} className="space-y-3" data-footer-group>
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground">
                {title}
              </h3>
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
            </nav>
          ))}
        </div>

        <div className="site-footer__base" data-footer-base>
          <p>© 2026 PlayTT. All rights reserved.</p>
          <p>Built in Nairobi</p>
        </div>
        </div>
      </div>
    </SiteFooterMotion>
  );
}
