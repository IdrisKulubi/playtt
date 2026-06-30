import Link from "next/link"
import { headers } from "next/headers"
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  ChartBarIcon,
  ClockIcon,
  CreditCardIcon,
  LightningIcon,
  MapPinIcon,
  PlayCircleIcon,
  SparkleIcon,
  UserCircleIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr"

import { auth } from "../../../auth"
import { AccountSignOutButton } from "@/components/account/account-sign-out-button"
import { PlayerShell } from "@/components/layout/player-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { listBookingsForUserEnriched } from "@/server/bookings/service"
import type { UserBookingSummary } from "@/server/bookings/types"

export const dynamic = "force-dynamic"

const dateFormatter = new Intl.DateTimeFormat("en-KE", {
  weekday: "short",
  month: "short",
  day: "numeric",
})

const timeFormatter = new Intl.DateTimeFormat("en-KE", {
  hour: "numeric",
  minute: "2-digit",
})

const moneyFormatter = new Intl.NumberFormat("en-KE", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

function formatMoney(amount: string, currency: string) {
  return `${currency} ${moneyFormatter.format(Number(amount))}`
}

function formatBookingTime(booking: UserBookingSummary) {
  const start = new Date(booking.startTime)
  const end = new Date(booking.endTime)

  return `${dateFormatter.format(start)}, ${timeFormatter.format(start)}-${timeFormatter.format(end)}`
}

function getInitials(name?: string | null) {
  const parts = (name || "Player").trim().split(/\s+/).filter(Boolean)

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function getDashboardBookings(bookings: UserBookingSummary[]) {
  const now = Date.now()
  const paymentNeeded = bookings.find(
    (booking) => booking.status === "pending" && booking.paymentStatus === "unpaid",
  )
  const upcoming = bookings.find(
    (booking) =>
      new Date(booking.endTime).getTime() >= now &&
      !(booking.status === "pending" && booking.paymentStatus === "unpaid"),
  )
  const completedCount = bookings.filter(
    (booking) => booking.status === "completed" || new Date(booking.endTime).getTime() < now,
  ).length

  return { paymentNeeded, upcoming, completedCount }
}

function BookingHero({
  booking,
  paymentNeeded,
}: {
  booking?: UserBookingSummary
  paymentNeeded?: UserBookingSummary
}) {
  const activeBooking = paymentNeeded || booking

  return (
    <section className="quiet-panel overflow-hidden bg-[var(--background-elevated)]">
      <div className="grid min-h-[28rem] lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={paymentNeeded ? "outline" : "default"}>
                {paymentNeeded
                  ? "Payment needed"
                  : booking
                    ? "Next session ready"
                    : "Ready when you are"}
              </Badge>
              <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                Private table tennis
              </span>
            </div>

            <h2 className="mt-7 max-w-2xl text-4xl font-semibold tracking-[-0.045em] text-foreground sm:text-5xl">
              {paymentNeeded
                ? "Finish payment and keep your table."
                : booking
                  ? "Your table is waiting."
                  : "Make tonight the easy plan."}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-muted-foreground">
              {paymentNeeded
                ? "One checkout step turns the hold into a confirmed PlayTT session."
                : booking
                  ? "Everything you need for the next rally stays in one calm place."
                  : "Pick a slot, bring your group, and step into a private rally without the usual back-and-forth."}
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="min-w-56 justify-between">
              <Link href={paymentNeeded ? "/bookings" : "/book"}>
                <CalendarCheckIcon className="size-4" weight="fill" />
                {paymentNeeded ? "Complete payment" : "Book a session"}
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/bookings">View bookings</Link>
            </Button>
          </div>
        </div>

        <div className="border-t border-border bg-card p-5 sm:p-6 lg:border-l lg:border-t-0">
          <div className="flex h-full flex-col justify-between rounded-[var(--radius-card)] bg-background p-5">
            <div>
              <p className="section-label">Session card</p>
              {activeBooking ? (
                <>
                  <h3 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                    {activeBooking.locationName}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeBooking.resourceName}
                  </p>
                  <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <ClockIcon className="size-4 text-primary" weight="fill" />
                      {formatBookingTime(activeBooking)}
                    </span>
                    <span className="flex items-center gap-2">
                      <UsersThreeIcon className="size-4 text-primary" weight="fill" />
                      {activeBooking.groupSize} players
                    </span>
                    <span className="flex items-center gap-2">
                      <CreditCardIcon className="size-4 text-primary" weight="fill" />
                      {formatMoney(activeBooking.totalAmount, activeBooking.currency)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                    No session booked yet.
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    Your next confirmed session, payment status, players, and
                    time will appear here.
                  </p>
                </>
              )}
            </div>

            <div className="mt-8 rounded-[var(--radius-field)] border border-border bg-card p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Rally lane
                </span>
                <SparkleIcon className="size-4 text-primary" weight="fill" />
              </div>
              <div className="relative h-28 overflow-hidden rounded-[1.25rem] border border-border bg-[var(--background-elevated)]">
                <div className="absolute inset-x-5 top-1/2 h-px bg-primary/40" />
                <div className="absolute bottom-5 left-5 top-5 w-px bg-border" />
                <div className="absolute bottom-5 right-5 top-5 w-px bg-border" />
                <div className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_24px_rgba(0,183,255,0.45)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function QuickActions() {
  const actions = [
    {
      href: "/activity",
      title: "Replay and activity",
      copy: "See session history, clips, and Coach progress.",
      icon: ChartBarIcon,
    },
    {
      href: "/community",
      title: "Bring your crew",
      copy: "Plan a private session and keep the group together.",
      icon: UsersThreeIcon,
    },
    {
      href: "/account",
      title: "Account ready",
      copy: "Check details, notifications, and security.",
      icon: UserCircleIcon,
    },
  ]

  return (
    <section className="grid gap-3 md:grid-cols-3">
      {actions.map(({ href, title, copy, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="quiet-panel group p-5 transition hover:-translate-y-0.5 hover:border-primary/40"
        >
          <div className="flex items-start justify-between gap-4">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="size-5" weight="fill" />
            </span>
            <ArrowRightIcon className="mt-3 size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
          <h3 className="mt-5 text-lg font-semibold tracking-[-0.03em] text-foreground">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
        </Link>
      ))}
    </section>
  )
}

function AccountRail({
  name,
  email,
  completedCount,
}: {
  name?: string | null
  email?: string | null
  completedCount: number
}) {
  if (!email) {
    return (
      <aside className="space-y-5">
        <section className="quiet-panel p-5 sm:p-6">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary/12 text-primary">
            <UserCircleIcon className="size-7" weight="fill" />
          </span>
          <p className="section-label mt-6">Account needed</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-foreground">
            Sign in to keep sessions in sync.
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Your bookings, payments, and activity history follow your PlayTT
            account across web and mobile.
          </p>
          <div className="mt-6 grid gap-3">
            <Button asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sign-up">Create account</Link>
            </Button>
          </div>
        </section>
      </aside>
    )
  }

  return (
    <aside className="space-y-5">
      <section className="quiet-panel p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
            {getInitials(name)}
          </span>
          <AccountSignOutButton />
        </div>
        <p className="section-label mt-6">Signed in</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-foreground">
          Welcome back, {name || "Player"}.
        </h2>
        {email ? (
          <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
            {email}
          </p>
        ) : null}
        <Button asChild className="mt-6 w-full justify-between">
          <Link href="/account">
            Account settings
            <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
      </section>

      <section className="quiet-panel p-5">
        <p className="section-label">Player rhythm</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-[var(--radius-field)] border border-border bg-card p-4">
            <PlayCircleIcon className="size-5 text-primary" weight="fill" />
            <p className="mt-4 text-2xl font-semibold text-foreground">
              {completedCount}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Completed sessions
            </p>
          </div>
          <div className="rounded-[var(--radius-field)] border border-border bg-card p-4">
            <LightningIcon className="size-5 text-primary" weight="fill" />
            <p className="mt-4 text-2xl font-semibold text-foreground">2h</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Edit window
            </p>
          </div>
        </div>
      </section>
    </aside>
  )
}

function BookingNudge() {
  return (
    <section className="quiet-panel p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="section-label">Good plan, low friction</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-foreground">
            Pick a time now, adjust later if the group changes.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            Booking keeps the slot simple: venue, table, group size, payment,
            and session updates all stay attached to your PlayTT account.
          </p>
        </div>
        <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3 lg:min-w-[26rem]">
          <span className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-3">
            <MapPinIcon className="size-4 text-primary" weight="fill" />
            Pick venue
          </span>
          <span className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-3">
            <ClockIcon className="size-4 text-primary" weight="fill" />
            Choose time
          </span>
          <span className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-3">
            <CreditCardIcon className="size-4 text-primary" weight="fill" />
            Pay securely
          </span>
        </div>
      </div>
    </section>
  )
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  const bookings = session?.user
    ? await listBookingsForUserEnriched({ userId: session.user.id })
    : []
  const { paymentNeeded, upcoming, completedCount } =
    getDashboardBookings(bookings)

  return (
    <PlayerShell eyebrow="Your player space" title="Home" backHref="/">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-5">
          <BookingHero booking={upcoming} paymentNeeded={paymentNeeded} />
          <QuickActions />
          <BookingNudge />
        </div>

        <AccountRail
          name={session?.user?.name}
          email={session?.user?.email}
          completedCount={completedCount}
        />
      </div>
    </PlayerShell>
  )
}
