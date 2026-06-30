import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "../../../../auth"
import { AccountNotificationPreferences } from "@/components/account/account-notification-preferences"
import { PlayerShell } from "@/components/layout/player-shell"

export const dynamic = "force-dynamic"

export default async function AccountNotificationsPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect("/sign-in")
  }

  return (
    <PlayerShell
      eyebrow="Player settings"
      title="Notifications"
      backHref="/account"
    >
      <div className="space-y-5">
        <section className="quiet-panel max-w-3xl p-5 sm:p-6">
          <p className="section-label">Preferences</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Choose useful alerts.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            Keep the reminders that help you get to the table and mute the
            ones you do not need.
          </p>
        </section>

        <AccountNotificationPreferences />
      </div>
    </PlayerShell>
  )
}
