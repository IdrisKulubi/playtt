"use client"

import type { DisplaySnapshotPayload } from "@/components/display/use-live-score"

const timeFormatter = new Intl.DateTimeFormat("en-KE", { hour: "numeric", minute: "2-digit" })

/**
 * The tablet when no session is running. Says what the table is for and what
 * happens next, from the same schedule the TV reads.
 */
export function TableFreeState({
  schedule,
  now,
}: {
  schedule: DisplaySnapshotPayload["schedule"] | undefined
  now: number
}) {
  const current = schedule?.current
  const next = schedule?.next
  const bookedNow =
    current &&
    new Date(current.startsAt).getTime() <= now &&
    new Date(current.endsAt).getTime() > now

  if (bookedNow) {
    return (
      <div className="max-w-xl text-center">
        <h2 className="text-5xl font-bold tracking-[-0.03em]">Hi, {current.firstName}.</h2>
        <p className="mt-4 text-xl text-white/70">
          Your session is starting. Replay and match scoring appear here in a moment.
        </p>
        <p className="mt-8 text-base text-white/50 tabular-nums">
          Booked until {timeFormatter.format(new Date(current.endsAt))}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-xl text-center">
      <h2 className="text-5xl font-bold tracking-[-0.03em]">Free to play</h2>
      <p className="mt-4 text-xl text-white/70">
        Book this table in the PlayTT app. During your session, this screen saves
        replays and keeps score on the TV.
      </p>
      <div className="mx-auto mt-10 h-px w-24 bg-white/15" aria-hidden />
      <p className="mt-6 text-lg text-white/80 tabular-nums">
        {next
          ? `Next booking at ${timeFormatter.format(new Date(next.startsAt))}`
          : "No more bookings today"}
      </p>
    </div>
  )
}
