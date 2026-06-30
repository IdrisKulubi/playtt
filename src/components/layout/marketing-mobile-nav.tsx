"use client";

import Link from "next/link";
import { ListIcon } from "@phosphor-icons/react";

import {
  MarketingMobileGuestLinks,
  MarketingMobileUserLinks,
} from "@/components/layout/marketing-mobile-auth-links";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface MarketingNavLink {
  label: string;
  href: string;
}

interface MarketingMobileNavProps {
  navLinks: MarketingNavLink[];
}

export function MarketingMobileNav({ navLinks }: MarketingMobileNavProps) {
  const { data: session, isPending } = authClient.useSession();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open menu"
        >
          <ListIcon />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="dark border-border bg-[var(--background-elevated)]"
      >
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>

        <nav aria-label="Main" className="flex flex-col gap-1 px-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-[var(--radius-field)] px-4 py-3 text-sm font-medium text-foreground transition hover:bg-white/[0.06]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3 border-t border-border p-6">
          {!isPending && session?.user ? (
            <MarketingMobileUserLinks
              name={session.user.name}
              email={session.user.email}
            />
          ) : (
            <MarketingMobileGuestLinks />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
