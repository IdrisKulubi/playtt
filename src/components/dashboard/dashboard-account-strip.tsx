import Link from "next/link"
import { ArrowRightIcon, UserCircleIcon } from "@phosphor-icons/react/dist/ssr"

import { AccountSignOutButton } from "@/components/account/account-sign-out-button"
import { Button } from "@/components/ui/button"

function getInitials(name?: string | null) {
  const parts = (name || "Player").trim().split(/\s+/).filter(Boolean)

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function DashboardAccountStrip({
  name,
  email,
}: {
  name?: string | null
  email?: string | null
}) {
  if (!email) {
    return (
      <section className="quiet-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/12 text-primary">
              <UserCircleIcon className="size-5" weight="fill" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Sign in to keep sessions in sync
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                Bookings follow your account across web and mobile.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/sign-up">Create account</Link>
            </Button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="quiet-panel p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {getInitials(name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {name || "Player"}
            </p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/account">
              Account
              <ArrowRightIcon className="size-4" />
            </Link>
          </Button>
          <AccountSignOutButton />
        </div>
      </div>
    </section>
  )
}
