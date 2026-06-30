import Link from "next/link";

import { Button } from "@/components/ui/button";

export function MarketingNavGuestActions() {
  return (
    <>
      <Link
        href="/sign-in"
        className="marketing-nav__sign-in hidden sm:inline"
        data-nav-action
      >
        Sign in
      </Link>
      <Button
        asChild
        variant="outline"
        size="sm"
        className="marketing-nav__create hidden sm:inline-flex"
      >
        <Link href="/sign-up" data-nav-action>
          Create account
        </Link>
      </Button>
      <Button asChild size="sm" className="marketing-nav__book">
        <Link href="/book" data-nav-action>
          Book now
        </Link>
      </Button>
    </>
  );
}
