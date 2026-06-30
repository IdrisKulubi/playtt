import Link from "next/link"
import { headers } from "next/headers"
import type { ReactNode } from "react"
import {
  ArrowRightIcon,
  BellIcon,
  CheckCircleIcon,
  CreditCardIcon,
  EnvelopeSimpleIcon,
  LockKeyIcon,
  QuestionIcon,
  ShieldCheckIcon,
  UserCircleIcon,
} from "@phosphor-icons/react/dist/ssr"

import { auth } from "../../../auth"
import { AccountSignOutButton } from "@/components/account/account-sign-out-button"
import { PlayerShell } from "@/components/layout/player-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getUserProfileById } from "@/server/users/onboarding"
import { getUserAuthMethods } from "@/server/users/profile"

export const dynamic = "force-dynamic"

type UserProfile = NonNullable<Awaited<ReturnType<typeof getUserProfileById>>>
type AuthMethods = Awaited<ReturnType<typeof getUserAuthMethods>>

const skillLabels: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  pro: "Pro",
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  if (!parts.length) {
    return "P"
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function formatSkillLevel(skillLevel?: string | null) {
  return skillLevel ? skillLabels[skillLevel] ?? skillLevel : "Not set"
}

function formatPhone(phone?: string | null) {
  if (!phone?.trim()) {
    return "No phone added"
  }

  const digits = phone.replace(/\D/g, "")

  if (digits.startsWith("254") && digits.length === 12) {
    return `0${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
  }

  return phone
}

function getAuthMethodLabel(authMethods?: AuthMethods | null) {
  if (!authMethods?.providers.length) {
    return "Email sign-in"
  }

  if (authMethods.providers.includes("apple")) {
    return "Apple"
  }

  if (authMethods.providers.includes("google")) {
    return "Google"
  }

  return authMethods.hasPassword ? "Email and password" : "Email sign-in"
}

function AccountOverview({
  profile,
  authMethods,
}: {
  profile: UserProfile
  authMethods: AuthMethods
}) {
  const setupItems = [
    {
      label: "Email verified",
      complete: profile.emailVerified,
    },
    {
      label: "Phone added",
      complete: Boolean(profile.phone?.trim()),
    },
    {
      label: "Skill level set",
      complete: Boolean(profile.skillLevel),
    },
  ]
  const completeCount = setupItems.filter((item) => item.complete).length

  return (
    <section className="quiet-panel overflow-hidden p-5 sm:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/12 text-lg font-semibold text-primary">
              {getInitials(profile.name)}
            </span>
            <div className="min-w-0">
              <p className="section-label">Your PlayTT account</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">
                {profile.name || "Player"}
              </h2>
            </div>
          </div>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground">
            Keep your profile, contact details, security, and preferences ready
            for faster booking and cleaner session updates.
          </p>
        </div>

        <div className="rounded-[var(--radius-field)] border border-border bg-card p-4 lg:min-w-64">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Setup
            </p>
            <Badge variant={completeCount === setupItems.length ? "default" : "outline"}>
              {completeCount}/{setupItems.length}
            </Badge>
          </div>
          <div className="mt-4 space-y-3">
            {setupItems.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <CheckCircleIcon
                  className={
                    item.complete
                      ? "size-4 text-primary"
                      : "size-4 text-muted-foreground/50"
                  }
                  weight={item.complete ? "fill" : "regular"}
                />
                <span className="text-sm text-muted-foreground">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <ProfileStat
          label="Email"
          value={profile.email}
          icon={EnvelopeSimpleIcon}
        />
        <ProfileStat
          label="Phone"
          value={formatPhone(profile.phone)}
          icon={UserCircleIcon}
        />
        <ProfileStat
          label="Skill"
          value={formatSkillLevel(profile.skillLevel)}
          icon={ShieldCheckIcon}
        />
      </div>

      <div className="mt-3 rounded-[var(--radius-field)] border border-border bg-background px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">Sign-in method</span>
          <span className="text-sm font-semibold text-foreground">
            {getAuthMethodLabel(authMethods)}
          </span>
        </div>
      </div>
    </section>
  )
}

function ProfileStat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof UserCircleIcon
}) {
  return (
    <div className="rounded-[var(--radius-field)] border border-border bg-card p-4">
      <Icon className="size-5 text-primary" weight="fill" />
      <p className="mt-4 truncate text-base font-semibold text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
    </div>
  )
}

function ActionRow({
  title,
  copy,
  href,
  icon: Icon,
  disabled = false,
}: {
  title: string
  copy: string
  href: string
  icon: typeof UserCircleIcon
  disabled?: boolean
}) {
  const content = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" weight="fill" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          {title}
        </span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {copy}
        </span>
      </span>
      {disabled ? (
        <Badge variant="outline">Soon</Badge>
      ) : (
        <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
      )}
    </>
  )

  if (disabled) {
    return (
      <div className="flex items-center gap-3 border-b border-border py-4 last:border-b-0">
        {content}
      </div>
    )
  }

  return (
    <Link
      href={href}
      className="flex items-center gap-3 border-b border-border py-4 transition-colors last:border-b-0 hover:text-primary"
    >
      {content}
    </Link>
  )
}

function SettingsSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="quiet-panel p-5 sm:p-6">
      <p className="section-label">{title}</p>
      <div className="mt-3 rounded-[var(--radius-field)] border border-border bg-card px-4">
        {children}
      </div>
    </section>
  )
}

function AccountRail({
  profile,
}: {
  profile: UserProfile
}) {
  return (
    <aside className="grid gap-5 sm:grid-cols-2 2xl:block 2xl:space-y-5">
      <div className="quiet-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="section-label">Signed in</p>
          <AccountSignOutButton />
        </div>
        <p className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-foreground">
          Welcome back, {profile.name || "Player"}.
        </p>
        <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
          {profile.email}
        </p>
        <Button asChild className="mt-5 w-full justify-between">
          <Link href="/book">
            Book a session
            <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
      </div>

      <div className="quiet-panel p-5">
        <p className="section-label">Account status</p>
        <p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-foreground">
          {profile.emailVerified ? "Ready to play." : "Verify your email."}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {profile.emailVerified
            ? "Your account can manage bookings, payments, replays, and profile updates."
            : "Email verification helps protect booking receipts and account recovery."}
        </p>
      </div>
    </aside>
  )
}

function SignInPrompt() {
  return (
    <section className="quiet-panel p-6 sm:p-8">
      <UserCircleIcon className="size-7 text-primary" weight="fill" />
      <p className="section-label mt-6">Account needed</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
        Sign in to manage your PlayTT account.
      </h2>
      <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
        Your profile, booking details, security, and preferences live behind
        your player account.
      </p>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/sign-up">Create account</Link>
        </Button>
      </div>
    </section>
  )
}

export default async function AccountPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    return (
      <PlayerShell eyebrow="Player settings" title="Account">
        <SignInPrompt />
      </PlayerShell>
    )
  }

  const [profile, authMethods] = await Promise.all([
    getUserProfileById(session.user.id),
    getUserAuthMethods(session.user.id),
  ])

  if (!profile) {
    return (
      <PlayerShell eyebrow="Player settings" title="Account">
        <SignInPrompt />
      </PlayerShell>
    )
  }

  return (
    <PlayerShell eyebrow="Player settings" title="Account">
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:gap-6">
        <div className="space-y-5">
          <AccountOverview profile={profile} authMethods={authMethods} />

          <SettingsSection title="Profile">
            <ActionRow
              title="Personal details"
              copy="Edit your name, phone, and playing level."
              href="/account/edit-profile"
              icon={UserCircleIcon}
            />
            <ActionRow
              title="Verify email"
              copy={
                profile.emailVerified
                  ? "Your email is verified."
                  : "Confirm your email for booking receipts and recovery."
              }
              href={`/account/verify-email?email=${encodeURIComponent(profile.email)}`}
              icon={EnvelopeSimpleIcon}
              disabled={profile.emailVerified}
            />
          </SettingsSection>

          <SettingsSection title="Preferences">
            <ActionRow
              title="Coach and clip packs"
              copy="Manage training, insights, and replay credits."
              href="/activity"
              icon={CreditCardIcon}
            />
            <ActionRow
              title="Notifications"
              copy="Choose reminders, replay alerts, and booking updates."
              href="/account/notifications"
              icon={BellIcon}
            />
          </SettingsSection>

          <SettingsSection title="Security and support">
            <ActionRow
              title="Password and sign-in"
              copy={
                authMethods.hasPassword
                  ? "Change your password and keep your account secure."
                  : "Review the sign-in method connected to this account."
              }
              href="/account/change-password"
              icon={LockKeyIcon}
            />
            <ActionRow
              title="Help"
              copy="FAQs and support for bookings, payments, replays, and Coach."
              href="/account/help"
              icon={QuestionIcon}
            />
          </SettingsSection>
        </div>

        <AccountRail profile={profile} />
      </div>
    </PlayerShell>
  )
}
