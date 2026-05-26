import type { ReactNode } from "react";
import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";

interface MarketingNavLink {
  label: string;
  href: string;
}

interface MarketingShellProps {
  children: ReactNode;
  navLinks?: MarketingNavLink[];
  actions?: ReactNode;
}

export function MarketingShell({
  children,
  navLinks = [],
  actions,
}: MarketingShellProps) {
  return (
    <main className="relative min-h-screen text-foreground">
      <div className="app-shell min-h-screen gap-10">
        <header className="shell-header sticky top-4 z-20 flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <BrandMark />

          {navLinks.length > 0 ? (
            <nav className="hidden items-center gap-3 md:flex">
              {navLinks.map((link) => (
                <Link key={link.href} className="shell-nav-link" href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
          ) : null}

          <div className="flex items-center gap-3">{actions}</div>
        </header>

        {children}
      </div>
    </main>
  );
}
