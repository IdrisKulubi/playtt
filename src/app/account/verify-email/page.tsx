import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr"

import { auth } from "../../../../auth"
import { AccountVerifyEmailPanel } from "@/components/account/account-verify-email-panel"
import { PlayerShell } from "@/components/layout/player-shell"
import { getUserProfileById } from "@/server/users/onboarding"

export const dynamic = "force-dynamic"

type VerifyEmailPageProps = {
  searchParams: Promise<{
    email?: string
  }>
}

export default async function AccountVerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect("/sign-in")
  }

  const [profile, params] = await Promise.all([
    getUserProfileById(session.user.id),
    searchParams,
  ])

  if (!profile) {
    redirect("/sign-in")
  }

  const email = params.email || profile.email

  return (
    <PlayerShell
      eyebrow="Player settings"
      title="Verify email"
      backHref="/account"
    >
      {profile.emailVerified ? (
        <section className="quiet-panel max-w-2xl p-5 sm:p-6">
          <CheckCircleIcon className="size-7 text-primary" weight="fill" />
          <p className="section-label mt-6">Verified</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Your email is already verified.
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Booking receipts, account recovery, and session updates can reach
            this address.
          </p>
        </section>
      ) : (
        <div className="space-y-5">
          <section className="quiet-panel max-w-2xl p-5 sm:p-6">
            <p className="section-label">Email security</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
              Confirm your email.
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Verification protects booking receipts and makes account recovery
              cleaner.
            </p>
          </section>

          <AccountVerifyEmailPanel email={email} />
        </div>
      )}
    </PlayerShell>
  )
}
