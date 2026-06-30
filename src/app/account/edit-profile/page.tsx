import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "../../../../auth"
import { AccountProfileForm } from "@/components/account/account-profile-form"
import { PlayerShell } from "@/components/layout/player-shell"
import { getUserProfileById } from "@/server/users/onboarding"

export const dynamic = "force-dynamic"

export default async function EditProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect("/sign-in")
  }

  const profile = await getUserProfileById(session.user.id)

  if (!profile) {
    redirect("/sign-in")
  }

  return (
    <PlayerShell
      eyebrow="Player settings"
      title="Personal details"
      backHref="/account"
    >
      <div className="space-y-5">
        <section className="quiet-panel max-w-3xl p-5 sm:p-6">
          <p className="section-label">Profile</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Keep booking details ready.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            These details help PlayTT confirm bookings, keep receipts clear,
            and tailor the player experience around your level.
          </p>
        </section>

        <AccountProfileForm
          initialName={profile.name}
          initialPhone={profile.phone ?? ""}
          initialSkillLevel={profile.skillLevel}
        />
      </div>
    </PlayerShell>
  )
}
