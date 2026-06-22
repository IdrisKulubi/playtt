import type { ReactNode } from "react";
import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";
import { MarketingMobileNav } from "@/components/layout/marketing-mobile-nav";
import { MarketingNavMotion } from "@/components/layout/marketing-nav-motion";

interface MarketingNavLink {
  label: string;
  href: string;
}

interface MarketingShellProps {
  children: ReactNode;
  navLinks?: MarketingNavLink[];
  actions?: ReactNode;
  footer?: ReactNode;
}

export function MarketingShell({
  children,
  navLinks = [],
  actions,
  footer,
}: MarketingShellProps) {
  return (
    <main className="dark relative min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen flex-col">
        <div className="marketing-nav-wrap">
          <MarketingNavMotion>
            <div className="marketing-nav__inner">
              <div className="marketing-nav__brand" data-nav-reveal>
              <BrandMark />
              {navLinks.length > 0 ? (
                <MarketingMobileNav navLinks={navLinks} />
              ) : null}
              </div>

              {navLinks.length > 0 ? (
                <nav aria-label="Main" className="marketing-nav__links">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      className="marketing-nav__link"
                      data-nav-action
                      data-nav-reveal
                      href={link.href}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
              ) : null}

              <div className="marketing-nav__actions" data-nav-reveal>
                {actions}
              </div>
            </div>
          </MarketingNavMotion>
        </div>

        <div className="flex flex-1 flex-col gap-10">{children}</div>

        {footer}
      </div>
    </main>
  );
}
