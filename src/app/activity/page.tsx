import Link from "next/link"
import { headers } from "next/headers"
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  ChartBarIcon,
  ClockIcon,
  CreditCardIcon,
} from "@phosphor-icons/react/dist/ssr"

import { auth } from "../../../auth"
import { PlayerShell } from "@/components/layout/player-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { listBookingsForUserEnriched } from "@/server/bookings/service"
import type { UserBookingSummary } from "@/server/bookings/types"
import {
  getReplayCreditsStatus,
  listUserReplays,
} from "@/server/replays/service"

export const dynamic = "force-dynamic"

type ReplaySummary = Awaited<ReturnType<typeof listUserReplays>>[number]
type ReplayCredits = Awaited<ReturnType<typeof getReplayCreditsStatus>>

const moneyFormatter = new Intl.NumberFormat("en-KE", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

const monthFormatter = new Intl.DateTimeFormat("en-KE", {
  month: "short",
})

const replayDateFormatter = new Intl.DateTimeFormat("en-KE", {
  month: "short",
  day: "numeric",
})

function formatMoney(amount: number, currency = "KES") {
  return `${currency} ${moneyFormatter.format(amount)}`
}

function formatDuration(seconds: number) {
  return `${seconds}s`
}

function safeNumber(value: string | number) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function getCompletedBookings(bookings: UserBookingSummary[]) {
  const now = Date.now()

  return bookings.filter((booking) => {
    const ended = new Date(booking.endTime).getTime() < now
    return booking.paymentStatus === "paid" && ended
  })
}

function getUpcomingPaidBookings(bookings: UserBookingSummary[]) {
  const now = Date.now()

  return bookings.filter((booking) => {
    const upcoming = new Date(booking.endTime).getTime() >= now
    return booking.paymentStatus === "paid" && upcoming
  })
}

function buildMonthlySessions(bookings: UserBookingSummary[]) {
  const recentMonths = Array.from({ length: 4 }, (_, index) => {
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() - (3 - index))

    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: monthFormatter.format(date),
      count: 0,
    }
  })

  for (const booking of bookings) {
    const date = new Date(booking.startTime)
    const key = `${date.getFullYear()}-${date.getMonth()}`
    const bucket = recentMonths.find((month) => month.key === key)

    if (bucket) {
      bucket.count += 1
    }
  }

  return recentMonths
}

function buildActivityStats(bookings: UserBookingSummary[]) {
  const completed = getCompletedBookings(bookings)
  const paid = bookings.filter((booking) => booking.paymentStatus === "paid")
  const totalMinutes = completed.reduce(
    (sum, booking) => sum + booking.durationMinutes,
    0,
  )
  const totalSpend = paid.reduce(
    (sum, booking) => sum + safeNumber(booking.totalAmount),
    0,
  )
  const peakSessions = completed.filter((booking) => {
    const hour = new Date(booking.startTime).getHours()
    return hour >= 17 && hour < 21
  }).length

  return {
    completed,
    hoursPlayed: Math.round((totalMinutes / 60) * 10) / 10,
    monthlySessions: buildMonthlySessions(completed),
    offPeakSessions: Math.max(completed.length - peakSessions, 0),
    paid,
    peakSessions,
    totalSpend,
    upcoming: getUpcomingPaidBookings(bookings),
  }
}

function SummaryStat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof ChartBarIcon
}) {
  return (
    <div className="rounded-[var(--radius-field)] border border-border bg-card p-4">
      <Icon className="size-5 text-primary" weight="fill" />
      <p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
    </div>
  )
}

function ReplayCard({ replay }: { replay: ReplaySummary }) {
  return (
    <article className="rounded-[var(--radius-field)] border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant={replay.status === "ready" ? "default" : "outline"}>
              {replay.status === "ready" ? "Ready" : "Processing"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDuration(replay.durationSeconds)}
            </span>
          </div>
          <h3 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-foreground">
            {replay.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {replay.locationName} /{" "}
            {replayDateFormatter.format(new Date(replay.recordedAt))}
          </p>
        </div>
        <div className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-field)] bg-primary/12 text-primary">
          <ChartBarIcon className="size-5" weight="fill" />
        </div>
      </div>
    </article>
  )
}

function ReplayPreviewEmpty() {
  return (
    <div className="rounded-[var(--radius-field)] border border-border bg-card p-5">
      <Badge variant="outline">Preview</Badge>
      <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-foreground">
        Replays collect here after you capture clips.
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Press Replay during an active session to save a short highlight. Ready
        clips will appear with the session, venue, and status.
      </p>
    </div>
  )
}

function MonthlyDotRow({
  month,
  count,
  maxCount,
}: {
  month: string
  count: number
  maxCount: number
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <div className="flex min-h-3 items-center gap-1">
        {Array.from({ length: 4 }, (_, index) => (
          <span
            key={index}
            className={
              index < count
                ? "size-2 rounded-full bg-primary"
                : "size-2 rounded-full border border-border"
            }
            style={
              index < count
                ? { opacity: 0.45 + (index / Math.max(maxCount, 1)) * 0.55 }
                : undefined
            }
          />
        ))}
      </div>
      <span className="text-xs font-semibold text-muted-foreground">{month}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </div>
  )
}

function StatsPanel({
  stats,
}: {
  stats: ReturnType<typeof buildActivityStats>
}) {
  const maxMonthCount = Math.max(
    ...stats.monthlySessions.map((item) => item.count),
    1,
  )

  return (
    <section className="quiet-panel p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-label">Stats</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
            {stats.hoursPlayed ? `${stats.hoursPlayed} hours on the table` : "Stats start after play"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {stats.completed.length
              ? `${stats.completed.length} completed sessions tracked from your paid bookings.`
              : "Completed sessions will build your time, spend, and peak-hour view."}
          </p>
        </div>
        <Badge variant="outline">Overview</Badge>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <SummaryStat
          icon={CalendarCheckIcon}
          label="Sessions"
          value={String(stats.completed.length)}
        />
        <SummaryStat
          icon={ClockIcon}
          label="Hours"
          value={String(stats.hoursPlayed)}
        />
        <SummaryStat
          icon={CreditCardIcon}
          label="Spend"
          value={formatMoney(stats.totalSpend)}
        />
      </div>

      <div className="mt-6 rounded-[var(--radius-field)] border border-border bg-background p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            By month
          </p>
          <span className="text-xs text-muted-foreground">Last 4 months</span>
        </div>
        <div className="mt-5 flex gap-3">
          {stats.monthlySessions.map((item) => (
            <MonthlyDotRow
              key={item.key}
              month={item.label}
              count={item.count}
              maxCount={maxMonthCount}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 divide-y divide-border rounded-[var(--radius-field)] border border-border bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-muted-foreground">Peak sessions</span>
          <span className="text-sm font-semibold text-foreground">
            {stats.peakSessions}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-muted-foreground">Off-peak sessions</span>
          <span className="text-sm font-semibold text-foreground">
            {stats.offPeakSessions}
          </span>
        </div>
      </div>
    </section>
  )
}

function HighlightsPanel({ replays }: { replays: ReplaySummary[] }) {
  const featured = replays[0]
  const earlier = replays.slice(1, 4)

  return (
    <section className="quiet-panel p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-label">Highlights</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Clips from your sessions
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Replays from active sessions appear here once the capture is ready.
          </p>
        </div>
        <Badge variant="outline">{replays.length ? "Live" : "Preview"}</Badge>
      </div>

      <div className="mt-6 grid gap-3">
        {featured ? <ReplayCard replay={featured} /> : <ReplayPreviewEmpty />}

        {earlier.length ? (
          <div className="rounded-[var(--radius-field)] border border-border bg-background">
            <div className="border-b border-border px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Earlier clips
              </p>
            </div>
            <div className="divide-y divide-border">
              {earlier.map((replay) => (
                <div
                  key={replay.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {replay.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {replay.locationName} /{" "}
                      {replayDateFormatter.format(new Date(replay.recordedAt))}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {formatDuration(replay.durationSeconds)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function ActivityRail({
  credits,
  stats,
}: {
  credits: ReplayCredits | null
  stats: ReturnType<typeof buildActivityStats>
}) {
  const nextSession = stats.upcoming[0]

  return (
    <aside className="grid gap-5 sm:grid-cols-2 2xl:block 2xl:space-y-5">
      <div className="quiet-panel p-5">
        <p className="section-label">Replay clips</p>
        <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-foreground">
          {credits ? credits.balance : 0}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {credits && credits.balance > 0
            ? "Each Replay press saves a 30-second highlight during play."
            : "Buy a clip pack in the app, then press Replay during play."}
        </p>
      </div>

      <div className="quiet-panel p-5">
        <p className="section-label">Next useful action</p>
        <p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-foreground">
          {nextSession ? "Play, then capture." : "Book a session."}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {nextSession
            ? "Your next paid session is ready. Activity grows after you play and capture clips."
            : "Your stats and replay library start after your first paid session."}
        </p>
        <Button asChild variant="outline" className="mt-5 w-full rounded-full">
          <Link href={nextSession ? "/bookings" : "/book"}>
            {nextSession ? "View booking" : "Book a session"}
            <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
      </div>
    </aside>
  )
}

function SignInPrompt() {
  return (
    <section className="quiet-panel p-6 sm:p-8">
      <ChartBarIcon className="size-7 text-primary" weight="fill" />
      <p className="section-label mt-6">Activity</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
        Sign in to see your play history.
      </h2>
      <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
        Your sessions, replay clips, credits, and stats are tied to your PlayTT
        account.
      </p>
      <Button asChild variant="outline" className="mt-7 rounded-full">
        <Link href="/sign-in">
          Sign in
          <ArrowRightIcon className="ml-2 size-4" />
        </Link>
      </Button>
    </section>
  )
}

export default async function ActivityPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    return (
      <PlayerShell eyebrow="Your time on the table" title="Activity">
        <SignInPrompt />
      </PlayerShell>
    )
  }

  const [bookings, replays, credits] = await Promise.all([
    listBookingsForUserEnriched({
      userId: session.user.id,
      filter: "all",
    }),
    listUserReplays(session.user.id).catch(() => []),
    getReplayCreditsStatus(session.user.id).catch(() => null),
  ])
  const stats = buildActivityStats(bookings)

  return (
    <PlayerShell eyebrow="Your time on the table" title="Activity">
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:gap-6">
        <div className="space-y-5">
          <section className="quiet-panel overflow-hidden p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ChartBarIcon className="size-6 text-primary" weight="fill" />
                  <Badge variant="outline">Overview</Badge>
                </div>
                <p className="section-label mt-6">Session history</p>
                <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">
                  {stats.completed.length
                    ? "Your table time is taking shape."
                    : "Your highlights start after your first session."}
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                  Activity brings together sessions, replay clips, clip credits,
                  and simple stats so progress is easy to scan.
                </p>
              </div>
              <Button asChild className="w-full lg:w-auto">
                <Link href="/book">
                  Book a session
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
            </div>
          </section>

          <HighlightsPanel replays={replays} />
          <StatsPanel stats={stats} />
        </div>

        <ActivityRail credits={credits} stats={stats} />
      </div>
    </PlayerShell>
  )
}
