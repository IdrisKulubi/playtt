"use client"

import type { ScoreState } from "@/server/scoring/types"

import {
  TvIdleScene,
  TvSessionScene,
  TvUpNextScene,
  useNow,
} from "@/components/display/tv-scenes"
import type { DisplaySnapshotPayload } from "@/components/display/use-live-score"
import { defaultTheme } from "@/lib/display-themes"

interface LiveScoreBoardProps {
  payload: DisplaySnapshotPayload
  variant: "kiosk" | "tv"
}

function formatSessionWindow(startAt: string, endAt: string) {
  const start = new Date(startAt)
  const end = new Date(endAt)
  const formatter = new Intl.DateTimeFormat("en-KE", {
    hour: "numeric",
    minute: "2-digit",
  })

  return `${formatter.format(start)} – ${formatter.format(end)}`
}

function PlayerPanel({
  label,
  games,
  points,
  isServer,
  variant,
}: {
  label: string
  games: number
  points: number
  isServer: boolean
  variant: "kiosk" | "tv"
}) {
  const pointsClass =
    variant === "tv"
      ? "text-[clamp(4rem,18vw,12rem)] leading-none font-black tracking-tight"
      : "text-[clamp(3rem,12vw,6rem)] leading-none font-black tracking-tight"

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-[2rem] border border-white/10 bg-white/5 px-6 py-8">
      <div className="flex items-center gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/60">
          {label}
        </p>
        {isServer ? (
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground">
            Serve
          </span>
        ) : null}
      </div>
      <p className={pointsClass}>{points}</p>
      <p className="text-lg text-white/70">
        Games <span className="font-semibold text-white">{games}</span>
      </p>
    </div>
  )
}

function MatchMeta({
  state,
  variant,
}: {
  state: ScoreState
  variant: "kiosk" | "tv"
}) {
  const statusLabel =
    state.matchStatus === "completed"
      ? "Match complete"
      : state.matchStatus === "in_progress"
        ? "In progress"
        : "Ready"

  return (
    <div
      className={
        variant === "tv"
          ? "flex flex-wrap items-center justify-center gap-4 text-sm uppercase tracking-[0.2em] text-white/55"
          : "flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-white/55"
      }
    >
      <span>{statusLabel}</span>
      <span>Best of {state.gamesToWin * 2 - 1}</span>
      <span>
        Game to {state.pointsToWin} · win by {state.winBy}
      </span>
    </div>
  )
}

/** Minutes before a booking when the TV switches to "Up next". */
const UP_NEXT_LEAD_MS = 5 * 60 * 1000

/**
 * Venue TV: follows the booking clock, not only the scoring hardware.
 * Free table → idle scene; 5 minutes before a booking → up next; during the
 * booking → the booker's session scene; once a point is scored → scoreboard.
 */
function TvBoard({ payload }: { payload: DisplaySnapshotPayload }) {
  const now = useNow()
  const state = payload.snapshot?.state
  const schedule = payload.schedule
  const tableName = payload.resource.name
  const venue = schedule?.venueName ?? "PlayTT"
  const theme = payload.theme ?? defaultTheme()

  const scoring =
    payload.status === "active" &&
    state &&
    (state.matchStatus !== "not_started" || state.pointsA + state.pointsB + state.gamesA + state.gamesB > 0)

  if (scoring) {
    return <LiveScoreBoard payload={payload} variant="tv" forceScoreboard />
  }

  // The server picks current/next at fetch time; re-check against the clock so
  // the scene flips on the exact second between 5-second refreshes.
  const candidates = [schedule?.current, schedule?.next].filter(
    (booking): booking is NonNullable<typeof booking> => Boolean(booking),
  )
  const current = candidates.find(
    (booking) =>
      new Date(booking.startsAt).getTime() <= now &&
      new Date(booking.endsAt).getTime() > now,
  )
  const upcoming = candidates.find(
    (booking) => new Date(booking.startsAt).getTime() > now,
  )

  if (current) {
    return <TvSessionScene key={current.bookingId} theme={theme} tableName={tableName} venue={venue} booking={current} />
  }

  if (payload.status === "active" && payload.playSession) {
    // Session started on the hardware without a matching booking on screen.
    return (
      <TvSessionScene
        key={payload.playSession.id}
        theme={theme}
        tableName={tableName}
        venue={venue}
        booking={{
          bookingId: payload.playSession.bookingId,
          firstName: "Game on",
          groupSize: 2,
          startsAt: payload.playSession.scheduledStartAt,
          endsAt: payload.playSession.scheduledEndAt,
        }}
      />
    )
  }

  if (upcoming && new Date(upcoming.startsAt).getTime() - now <= UP_NEXT_LEAD_MS) {
    return <TvUpNextScene key={`next-${upcoming.bookingId}`} theme={theme} tableName={tableName} venue={venue} booking={upcoming} />
  }

  return <TvIdleScene theme={theme} tableName={tableName} venue={venue} next={upcoming ?? null} />
}

export function LiveScoreBoard({
  payload,
  variant,
  forceScoreboard = false,
}: LiveScoreBoardProps & { forceScoreboard?: boolean }) {
  if (variant === "tv" && !forceScoreboard) {
    return <TvBoard payload={payload} />
  }

  const state = payload.snapshot?.state
  const sessionWindow =
    payload.playSession &&
    formatSessionWindow(
      payload.playSession.scheduledStartAt,
      payload.playSession.scheduledEndAt,
    )

  if (payload.status === "idle" || !state) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-6 text-center text-white">
        <p className="text-sm uppercase tracking-[0.24em] text-white/45">
          {payload.resource.name}
        </p>
        <h1
          className={
            variant === "tv"
              ? "mt-6 text-5xl font-semibold"
              : "mt-4 text-3xl font-semibold"
          }
        >
          Waiting for active session
        </h1>
        <p className="mt-4 max-w-xl text-white/60">
          Score updates appear here when a play session is active on this table.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] px-4 py-6 text-white sm:px-8 sm:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-2 text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-white/45">
            {payload.resource.code ?? payload.resource.slug}
          </p>
          <h1
            className={
              variant === "tv"
                ? "text-4xl font-semibold sm:text-5xl"
                : "text-2xl font-semibold sm:text-3xl"
            }
          >
            {payload.resource.name}
          </h1>
          {sessionWindow ? (
            <p className="text-sm text-white/55">{sessionWindow}</p>
          ) : null}
        </header>

        <MatchMeta state={state} variant={variant} />

        <div className="grid flex-1 gap-4 md:grid-cols-2">
          <PlayerPanel
            label="Player A"
            games={state.gamesA}
            points={state.pointsA}
            isServer={state.server === "a"}
            variant={variant}
          />
          <PlayerPanel
            label="Player B"
            games={state.gamesB}
            points={state.pointsB}
            isServer={state.server === "b"}
            variant={variant}
          />
        </div>

        <footer className="text-center text-xs uppercase tracking-[0.18em] text-white/35">
          Snapshot v{payload.snapshot?.version ?? 0}
        </footer>
      </div>
    </div>
  )
}
