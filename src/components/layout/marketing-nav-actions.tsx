"use client";

import Link from "next/link";

import { MarketingNavGuestActions } from "@/components/layout/marketing-nav-guest-actions";
import { MarketingUserMenu } from "@/components/layout/marketing-user-menu";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function MarketingNavActions() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div
        className="marketing-nav__actions-placeholder hidden h-9 w-28 rounded-full bg-white/10 sm:block"
        aria-hidden
      />
    );
  }

  if (session?.user) {
    return (
      <>
        <MarketingUserMenu
          name={session.user.name}
          email={session.user.email}
        />
        <Button asChild size="sm" className="marketing-nav__book">
          <Link href="/book" data-nav-action>
            Book now
          </Link>
        </Button>
      </>
    );
  }

  return <MarketingNavGuestActions />;
}
