import Link from "next/link"
import { headers } from "next/headers"
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  ClockIcon,
  CreditCardIcon,
  PlusIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr"

import { auth } from "../../../auth"
import { PlayerShell } from "@/components/layout/player-shell"
import { BookingPaymentButton } from "@/components/bookings/booking-payment-button"
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

function formatTimeRange(booking: UserBookingSummary) {
  const start = new Date(booking.startTime)
  const end = new Date(booking.endTime)
  return `${dateFormatter.format(start)} · ${timeFormatter.format(start)}-${timeFormatter.format(end)}`
}

function getStatusTone(
  booking: UserBookingSummary,
): "default" | "outline" | "secondary" {
  if (booking.paymentStatus === "paid") {
    return "default"
  }

  if (booking.status === "pending") {
    return "outline"
  }

  return "secondary"
}

function getStatusLabel(booking: UserBookingSummary) {
  if (booking.paymentStatus === "paid" || booking.status === "confirmed") {
    return "Confirmed"
  }

  if (booking.status === "pending" && booking.paymentStatus === "unpaid") {
    return "Payment needed"
  }

  if (booking.status === "completed") {
    return "Completed"
  }

  return booking.status.replaceAll("_", " ")
}

function BookingCard({ booking }: { booking: UserBookingSummary }) {
  return (
    <article className="rounded-[var(--radius-field)] border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getStatusTone(booking)}>{getStatusLabel(booking)}</Badge>
            {booking.editable ? (
              <Badge variant="outline">Editable until 2 hours before play</Badge>
            ) : null}
          </div>

          <h2 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-foreground">
            {booking.locationName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {booking.resourceName}
          </p>

          <div className="mt-5 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <span className="flex items-center gap-2">
              <ClockIcon className="size-4 text-primary" />
              {formatTimeRange(booking)}
            </span>
            <span className="flex items-center gap-2">
              <UsersThreeIcon className="size-4 text-primary" />
              {booking.groupSize} players
            </span>
            <span className="flex items-center gap-2">
              <CreditCardIcon className="size-4 text-primary" />
              {formatMoney(booking.totalAmount, booking.currency)}
            </span>
          </div>
        </div>

        {booking.status === "pending" && booking.paymentStatus === "unpaid" ? (
          <BookingPaymentButton bookingId={booking.id} />
        ) : null}
      </div>
    </article>
  )
}

function BookingSection({
  title,
  copy,
  bookings,
}: {
  title: string
  copy: string
  bookings: UserBookingSummary[]
}) {
  if (bookings.length === 0) {
    return null
  }

  return (
    <section>
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{copy}</p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
          {bookings.length} {bookings.length === 1 ? "session" : "sessions"}
        </span>
      </div>
      <div className="grid gap-3">
        {bookings.map((booking) => (
          <BookingCard key={booking.id} booking={booking} />
        ))}
      </div>
    </section>
  )
}

function EmptyBookings() {
  return (
    <div className="quiet-panel overflow-hidden bg-[var(--background-elevated)]">
      <div className="grid min-h-[25rem] gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(17rem,0.55fr)]">
        <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10">
          <div>
            <div className="flex size-12 items-center justify-center rounded-[var(--radius-field)] bg-primary/12 text-primary">
              <CalendarCheckIcon className="size-6" weight="fill" />
            </div>
            <p className="section-label mt-8">No sessions yet</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">
              Book your first table, then track every detail here.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              Reservations, payment status, venue details, and post-session
              history will settle into this space after checkout.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="min-w-52">
              <Link href="/book">
                <PlusIcon className="size-4" />
                Book a session
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
            <p className="max-w-xs text-xs leading-5 text-muted-foreground">
              Takes under a minute once you know your time and group size.
            </p>
          </div>
        </div>

        <div className="border-t border-border bg-card p-5 sm:p-6 lg:border-l lg:border-t-0">
          <p className="section-label">Synced account</p>
          <div className="mt-6 space-y-3">
            {[
              ["Payment", "Paid sessions appear here after Paystack confirms."],
              ["Mobile", "Open the app with the same account to see the same bookings."],
              ["History", "Completed sessions move into your past list after play."],
            ].map(([title, copy]) => (
              <div
                key={title}
                className="rounded-[var(--radius-field)] border border-border bg-background px-4 py-4"
              >
                <span className="block text-sm font-semibold text-foreground">
                  {title}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {copy}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function SignInPrompt() {
  return (
    <div className="quiet-panel bg-[var(--background-elevated)] p-6 sm:p-8">
      <div className="flex max-w-2xl flex-col items-start gap-5">
        <div className="flex size-12 items-center justify-center rounded-[var(--radius-field)] bg-primary/12 text-primary">
          <CalendarCheckIcon className="size-6" weight="fill" />
        </div>
        <div>
          <p className="section-label">Account needed</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Sign in to see your sessions.
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Web and mobile bookings sync through your PlayTT account. Use the
            same sign-in on both surfaces to see the same paid sessions.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/sign-in">
            Sign in
            <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

function groupBookings(bookings: UserBookingSummary[]) {
  const now = Date.now()
  const upcoming = bookings.filter(
    (booking) =>
      new Date(booking.endTime).getTime() >= now &&
      !(booking.status === "pending" && booking.paymentStatus === "unpaid"),
  )
  const paymentNeeded = bookings.filter(
    (booking) => booking.status === "pending" && booking.paymentStatus === "unpaid",
  )
  const past = bookings.filter(
    (booking) => new Date(booking.endTime).getTime() < now,
  )

  return { past, paymentNeeded, upcoming }
}

function BookingHelpAside({
  nextBooking,
  paymentBooking,
}: {
  nextBooking?: UserBookingSummary
  paymentBooking?: UserBookingSummary
}) {
  const attentionBooking = paymentBooking ?? nextBooking

  return (
    <aside className="grid gap-5 sm:grid-cols-2 2xl:block 2xl:space-y-5">
      <div className="quiet-panel p-5">
        <div className="flex size-10 items-center justify-center rounded-[var(--radius-field)] bg-primary/12 text-primary">
          {paymentBooking ? (
            <CreditCardIcon className="size-5" weight="fill" />
          ) : (
            <CalendarCheckIcon className="size-5" weight="fill" />
          )}
        </div>

        <p className="mt-5 text-sm font-semibold text-foreground">
          {paymentBooking
            ? "Finish payment"
            : nextBooking
              ? "Next session"
              : "Ready when you are"}
        </p>

        {attentionBooking ? (
          <>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-foreground">
              {attentionBooking.locationName}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {formatTimeRange(attentionBooking)} · {attentionBooking.groupSize} players
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Choose a time, set your group size, then confirm payment from
            checkout.
          </p>
        )}

        {paymentBooking ? (
          <div className="mt-5">
            <BookingPaymentButton bookingId={paymentBooking.id} />
          </div>
        ) : (
          <Button asChild variant="outline" className="mt-5 w-full rounded-full">
            <Link href="/book">
              {nextBooking ? "Book another session" : "Book a session"}
              <ArrowRightIcon className="size-4" />
            </Link>
          </Button>
        )}
      </div>

      <div className="quiet-panel p-5">
        <p className="section-label">PlayTT mobile</p>
        <p className="mt-4 text-xl font-semibold tracking-[-0.03em] text-foreground">
          Open in the app.
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Use the same account in PlayTT mobile to see this session, check
          payment status, and make allowed edits before the cutoff.
        </p>
      </div>
    </aside>
  )
}

export default async function BookingsPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    return (
      <PlayerShell eyebrow="Your reservations" title="Bookings">
        <SignInPrompt />
      </PlayerShell>
    )
  }

  const bookings = await listBookingsForUserEnriched({
    userId: session.user.id,
    filter: "all",
  })

  const { past, paymentNeeded, upcoming } = groupBookings(bookings)

  return (
    <PlayerShell eyebrow="Your reservations" title="Bookings">
      {bookings.length === 0 ? (
        <EmptyBookings />
      ) : (
        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:gap-6">
          <div className="space-y-8">
            <BookingSection
              title="Payment needed"
              copy="Slots held for checkout stay visible here until the payment window closes."
              bookings={paymentNeeded}
            />
            <BookingSection
              title="Upcoming sessions"
              copy="Your confirmed reservations, timing, table, and payment status in one place."
              bookings={upcoming}
            />
            <BookingSection
              title="Past sessions"
              copy="Your completed play history stays available after the session ends."
              bookings={past}
            />
          </div>

          <BookingHelpAside
            nextBooking={upcoming[0]}
            paymentBooking={paymentNeeded[0]}
          />
        </div>
      )}
    </PlayerShell>
  )
}
