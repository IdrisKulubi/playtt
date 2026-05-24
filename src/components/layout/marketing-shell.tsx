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
    <main className="relative min-h-screen overflow-hidden text-foreground">
      <div className="hero-orb left-[-8rem] top-10 h-72 w-72 bg-primary/20" />
      <div className="hero-orb right-[-7rem] top-28 h-80 w-80 bg-sky-500/12" />
      <div className="playtt-grid absolute inset-0 opacity-30" />

      <div className="app-shell min-h-screen gap-10">
        <header className="glass-panel sticky top-4 z-20 flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
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
