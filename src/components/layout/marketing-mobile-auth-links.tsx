"use client";

import Link from "next/link";

import {
  getMarketingUserLabel,
  MARKETING_SIGN_OUT_ITEM,
  MARKETING_USER_LINKS,
} from "@/components/layout/marketing-nav-items";
import { useMarketingSignOut } from "@/components/layout/use-marketing-sign-out";
import { Button } from "@/components/ui/button";

interface MarketingMobileAuthLinksProps {
  name?: string | null;
  email?: string | null;
}

export function MarketingMobileGuestLinks() {
  return (
    <>
      <Button asChild variant="outline" className="w-full">
        <Link href="/sign-up">Create account</Link>
      </Button>
      <Link
        href="/sign-in"
        className="text-center text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        Sign in
      </Link>
    </>
  );
}

export function MarketingMobileUserLinks({
  name,
  email,
}: MarketingMobileAuthLinksProps) {
  const { signOut, isSigningOut } = useMarketingSignOut();
  const label = getMarketingUserLabel(name, email);
  const SignOutIcon = MARKETING_SIGN_OUT_ITEM.icon;

  return (
    <>
      <div className="rounded-[var(--radius-field)] border border-border bg-white/[0.04] px-4 py-3">
        <p className="truncate text-sm font-semibold text-foreground">{label}</p>
        {email ? (
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        ) : null}
      </div>
      <nav aria-label="Account" className="flex flex-col gap-1">
        {MARKETING_USER_LINKS.map(({ label: itemLabel, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2.5 rounded-[var(--radius-field)] px-4 py-3 text-sm font-medium text-foreground transition hover:bg-white/[0.06]"
          >
            <Icon className="size-4" />
            {itemLabel}
          </Link>
        ))}
      </nav>
      <Button
        variant="outline"
        className="w-full"
        disabled={isSigningOut}
        onClick={() => void signOut()}
      >
        <SignOutIcon className="size-4" />
        {isSigningOut ? "Signing out..." : MARKETING_SIGN_OUT_ITEM.label}
      </Button>
    </>
  );
}
