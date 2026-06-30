import { headers } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"
import { LockKeyIcon } from "@phosphor-icons/react/dist/ssr"

import { auth } from "../../../../auth"
import { AccountChangePasswordForm } from "@/components/account/account-change-password-form"
import { PlayerShell } from "@/components/layout/player-shell"
import { Button } from "@/components/ui/button"
import { getUserAuthMethods } from "@/server/users/profile"

export const dynamic = "force-dynamic"

export default async function ChangePasswordPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect("/sign-in")
  }

  const authMethods = await getUserAuthMethods(session.user.id)

  return (
    <PlayerShell
      eyebrow="Player settings"
      title="Password and sign-in"
      backHref="/account"
    >
      {authMethods.hasPassword ? (
        <div className="space-y-5">
          <section className="quiet-panel max-w-2xl p-5 sm:p-6">
            <p className="section-label">Security</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
              Change your password.
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Use a password that is hard to guess and not reused on another
              service.
            </p>
          </section>

          <AccountChangePasswordForm />
        </div>
      ) : (
        <section className="quiet-panel max-w-2xl p-5 sm:p-6">
          <LockKeyIcon className="size-7 text-primary" weight="fill" />
          <p className="section-label mt-6">Connected sign-in</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
            This account does not use a PlayTT password.
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            You are signed in with a connected provider. Manage that password
            with the provider, or use password reset if you add email password
            sign-in later.
          </p>
          <Button asChild className="mt-6">
            <Link href="/account">Back to account</Link>
          </Button>
        </section>
      )}
    </PlayerShell>
  )
}
