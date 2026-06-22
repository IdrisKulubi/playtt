import type { ReactNode } from "react";
import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";
import { MarketingMobileNav } from "@/components/layout/marketing-mobile-nav";

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
    <main className="dark relative min-h-screen text-foreground">
      <div className="flex min-h-screen flex-col">
        <div className="app-shell flex flex-1 flex-col gap-10">
          <header className="shell-header glass-panel-strong sticky top-4 z-20 flex items-center justify-between gap-3 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-4">
            <div className="flex min-w-0 items-center gap-2">
              <BrandMark />
              {navLinks.length > 0 ? (
                <MarketingMobileNav navLinks={navLinks} />
              ) : null}
            </div>

            {navLinks.length > 0 ? (
              <nav
                aria-label="Main"
                className="hidden items-center gap-5 lg:flex"
              >
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    className="shell-nav-link"
                    href={link.href}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            ) : null}

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {actions}
            </div>
          </header>

          {children}
        </div>

        {footer}
      </div>
    </main>
  );
}
