"use client";

import Link from "next/link";
import { ListIcon } from "@phosphor-icons/react";

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
          <Button asChild variant="outline" className="w-full">
            <Link href="/sign-up">Create account</Link>
          </Button>
          <Link
            href="/sign-in"
            className="text-center text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Sign in
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
