import Link from "next/link"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { ArrowRightIcon, CalendarCheckIcon } from "@phosphor-icons/react/dist/ssr"

import { BookingDetailView } from "@/components/bookings/booking-detail-view"
import { PlayerShell } from "@/components/layout/player-shell"
import { Button } from "@/components/ui/button"
import { auth } from "../../../../auth"
import { getBookingForUser } from "@/server/bookings/service"

export const dynamic = "force-dynamic"

type BookingDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
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
            Sign in to view this session.
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Your bookings sync through your PlayTT account on web and mobile.
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

export default async function BookingDetailPage({
  params,
  searchParams,
}: BookingDetailPageProps) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    return (
      <PlayerShell eyebrow="Your reservations" title="Session">
        <SignInPrompt />
      </PlayerShell>
    )
  }

  const { id } = await params
  const { edit } = await searchParams
  const booking = await getBookingForUser({
    userId: session.user.id,
    bookingId: id,
  })

  if (!booking) {
    notFound()
  }

  if (edit === "players" && !booking.editable) {
    redirect(`/bookings/${id}`)
  }

  return (
    <PlayerShell eyebrow="Your reservations" title="Session" backHref="/dashboard">
      <BookingDetailView
        booking={booking}
        openEditOnMount={edit === "players"}
      />
    </PlayerShell>
  )
}
